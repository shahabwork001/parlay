using RabbitMQ.Client;

namespace Parley.Infrastructure.Messaging;

/// <summary>
/// Broker layout. All events go to one durable topic exchange keyed by <c>IIntegrationEvent.RoutingKey</c>.
/// Each subscriber owns a quorum queue; messages that exceed the delivery limit move to that queue's
/// <c>.dead-letter</c> queue via a direct dead-letter exchange.
/// </summary>
internal static class RabbitMqTopology
{
    public const string EventsExchange = "parley.events";
    public const string DeadLetterExchange = "parley.dead-letter";

    public static async Task DeclareExchangesAsync(IChannel channel, CancellationToken cancellationToken)
    {
        await channel.ExchangeDeclareAsync(EventsExchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync(DeadLetterExchange, ExchangeType.Direct, durable: true, autoDelete: false, cancellationToken: cancellationToken);
    }

    public static async Task DeclareSubscriptionAsync(
        IChannel channel,
        string queueName,
        string routingKey,
        int deliveryLimit,
        CancellationToken cancellationToken)
    {
        await DeclareExchangesAsync(channel, cancellationToken);

        var deadLetterQueue = $"{queueName}.dead-letter";
        await channel.QueueDeclareAsync(
            deadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?> { ["x-queue-type"] = "quorum" },
            cancellationToken: cancellationToken);
        await channel.QueueBindAsync(deadLetterQueue, DeadLetterExchange, queueName, cancellationToken: cancellationToken);

        await channel.QueueDeclareAsync(
            queueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-queue-type"] = "quorum",
                ["x-delivery-limit"] = deliveryLimit,
                ["x-dead-letter-exchange"] = DeadLetterExchange,
                ["x-dead-letter-routing-key"] = queueName,
            },
            cancellationToken: cancellationToken);
        await channel.QueueBindAsync(queueName, EventsExchange, routingKey, cancellationToken: cancellationToken);
    }
}
