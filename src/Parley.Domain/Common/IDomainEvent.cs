namespace Parley.Domain.Common;

public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}
