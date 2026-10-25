using Parley.Application.Abstractions.Messaging;
using RabbitMQ.Client;

namespace Parley.Infrastructure.Messaging;

/// <summary>
/// Publishes persistent messages with publisher confirms, so a completed <see cref="PublishAsync{TEvent}"/>
/// means the broker has taken responsibility for the message.
/// </summary>
internal sealed class RabbitMqEventPublisher(RabbitMqConnection connection) : IEventPublisher, IAsyncDisposable
{
    private static readonly CreateChannelOptions ConfirmingChannel = new(
        publisherConfirmationsEnabled: true,
        publisherConfirmationTrackingEnabled: true);

    private readonly SemaphoreSlim _gate = new(1, 1);
    private IChannel? _channel;

    public async Task PublishAsync<TEvent>(TEvent integrationEvent, CancellationToken cancellationToken = default)
        where TEvent : IIntegrationEvent
    {
        var properties = new BasicProperties
        {
            MessageId = integrationEvent.EventId.ToString(),
            Type = TEvent.RoutingKey,
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent,
            Timestamp = new AmqpTimestamp(integrationEvent.OccurredAt.ToUnixTimeSeconds()),
        };
        var body = IntegrationEventSerializer.Serialize(integrationEvent);

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var channel = await GetChannelAsync(cancellationToken);
            await channel.BasicPublishAsync(
                RabbitMqTopology.EventsExchange,
                TEvent.RoutingKey,
                mandatory: false,
                properties,
                body,
                cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.DisposeAsync();
        }

        _gate.Dispose();
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        if (_channel is not null)
        {
            await _channel.DisposeAsync();
        }

        var brokerConnection = await connection.GetAsync(cancellationToken);
        _channel = await brokerConnection.CreateChannelAsync(ConfirmingChannel, cancellationToken);
        await RabbitMqTopology.DeclareExchangesAsync(_channel, cancellationToken);
        return _channel;
    }
}
