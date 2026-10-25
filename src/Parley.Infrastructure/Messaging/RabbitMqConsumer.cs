using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Parley.Application.Abstractions.Messaging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RabbitMQ.Client.Exceptions;

namespace Parley.Infrastructure.Messaging;

/// <summary>
/// Consumes one event type from a dedicated quorum queue and dispatches each message to a scoped
/// <see cref="IIntegrationEventHandler{TEvent}"/>. Handler failures are requeued until the queue's
/// delivery limit dead-letters them; malformed messages are dead-lettered immediately.
/// </summary>
internal sealed partial class RabbitMqConsumer<TEvent>(
    string queueName,
    RabbitMqConnection connection,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<RabbitMqConsumer<TEvent>> logger) : BackgroundService
    where TEvent : IIntegrationEvent
{
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(5);
    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await StartConsumingAsync(stoppingToken);
                return;
            }
            catch (Exception exception) when (exception is BrokerUnreachableException or OperationInterruptedException or IOException)
            {
                LogBrokerUnavailable(exception, queueName, ReconnectDelay.TotalSeconds);
                await Task.Delay(ReconnectDelay, stoppingToken);
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        if (_channel is not null)
        {
            await _channel.DisposeAsync();
        }
    }

    private async Task StartConsumingAsync(CancellationToken stoppingToken)
    {
        var brokerConnection = await connection.GetAsync(stoppingToken);
        _channel = await brokerConnection.CreateChannelAsync(cancellationToken: stoppingToken);
        await _channel.BasicQosAsync(0, options.Value.PrefetchCount, global: false, stoppingToken);
        await RabbitMqTopology.DeclareSubscriptionAsync(
            _channel,
            queueName,
            TEvent.RoutingKey,
            options.Value.DeliveryLimit,
            stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += (_, delivery) => HandleDeliveryAsync(delivery, stoppingToken);
        await _channel.BasicConsumeAsync(queueName, autoAck: false, consumer, stoppingToken);
        LogConsuming(queueName, TEvent.RoutingKey);
    }

    private async Task HandleDeliveryAsync(BasicDeliverEventArgs delivery, CancellationToken stoppingToken)
    {
        var channel = _channel!;
        TEvent? integrationEvent;
        try
        {
            integrationEvent = IntegrationEventSerializer.Deserialize<TEvent>(delivery.Body);
        }
        catch (JsonException exception)
        {
            LogMalformedMessage(exception, queueName, delivery.BasicProperties.MessageId);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false, stoppingToken);
            return;
        }

        if (integrationEvent is null)
        {
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false, stoppingToken);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var handler = scope.ServiceProvider.GetRequiredService<IIntegrationEventHandler<TEvent>>();
            await handler.HandleAsync(integrationEvent, stoppingToken);
            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, stoppingToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogHandlerFailed(exception, queueName, integrationEvent.EventId);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true, stoppingToken);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Consuming {RoutingKey} from queue {Queue}")]
    private partial void LogConsuming(string queue, string routingKey);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Broker unavailable for queue {Queue}; retrying in {DelaySeconds}s")]
    private partial void LogBrokerUnavailable(Exception exception, string queue, double delaySeconds);

    [LoggerMessage(Level = LogLevel.Error, Message = "Malformed message {MessageId} on queue {Queue}; dead-lettering")]
    private partial void LogMalformedMessage(Exception exception, string queue, string? messageId);

    [LoggerMessage(Level = LogLevel.Error, Message = "Handler failed for event {EventId} on queue {Queue}; requeueing")]
    private partial void LogHandlerFailed(Exception exception, string queue, Guid eventId);
}
