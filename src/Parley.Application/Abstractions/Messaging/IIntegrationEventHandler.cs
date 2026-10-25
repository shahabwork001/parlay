namespace Parley.Application.Abstractions.Messaging;

/// <summary>
/// Handles one integration event type. Handlers must be idempotent: the broker delivers at least once.
/// Throwing causes a redelivery; after the configured delivery limit the message is dead-lettered.
/// </summary>
public interface IIntegrationEventHandler<in TEvent>
    where TEvent : IIntegrationEvent
{
    Task HandleAsync(TEvent integrationEvent, CancellationToken cancellationToken);
}
