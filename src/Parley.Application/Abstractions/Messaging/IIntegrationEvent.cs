namespace Parley.Application.Abstractions.Messaging;

/// <summary>An event published to the message broker for asynchronous, cross-process handling.</summary>
public interface IIntegrationEvent
{
    /// <summary>Stable broker routing key, e.g. <c>reports.created.v1</c>. Never change it once published.</summary>
    static abstract string RoutingKey { get; }

    Guid EventId { get; }

    DateTimeOffset OccurredAt { get; }
}
