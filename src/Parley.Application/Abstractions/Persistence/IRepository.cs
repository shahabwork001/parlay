using Parley.Domain.Common;

namespace Parley.Application.Abstractions.Persistence;

/// <summary>Persistence port for a single aggregate type. Implementations live in Infrastructure.</summary>
public interface IRepository<TAggregate>
    where TAggregate : AggregateRoot
{
    Task<TAggregate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(TAggregate aggregate, CancellationToken cancellationToken = default);

    /// <summary>Persists changes using optimistic concurrency on <see cref="AggregateRoot.Version"/>.</summary>
    /// <returns><c>false</c> when the aggregate was modified concurrently or no longer exists.</returns>
    Task<bool> UpdateAsync(TAggregate aggregate, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
