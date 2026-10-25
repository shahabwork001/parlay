using MongoDB.Driver;

namespace Parley.Infrastructure.Persistence.Mongo;

/// <summary>Declares the indexes (including TTL indexes) for one collection. Applied idempotently on startup.</summary>
internal interface IMongoIndexDefinition
{
    string CollectionName { get; }

    Task ApplyAsync(IMongoDatabase database, CancellationToken cancellationToken);
}
