using MongoDB.Driver;
using Parley.Application.Abstractions.Persistence;
using Parley.Domain.Common;

namespace Parley.Infrastructure.Persistence.Mongo;

/// <summary>Generic Mongo-backed repository with optimistic concurrency on <see cref="AggregateRoot.Version"/>.</summary>
internal abstract class MongoRepository<TAggregate>(IMongoDatabase database, string collectionName)
    : IRepository<TAggregate>
    where TAggregate : AggregateRoot
{
    protected IMongoCollection<TAggregate> Collection { get; } = database.GetCollection<TAggregate>(collectionName);

    protected static FilterDefinitionBuilder<TAggregate> Filter => Builders<TAggregate>.Filter;

    public async Task<TAggregate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await Collection.Find(Filter.Eq(aggregate => aggregate.Id, id)).FirstOrDefaultAsync(cancellationToken);

    public async Task AddAsync(TAggregate aggregate, CancellationToken cancellationToken = default)
    {
        aggregate.Version = 1;
        await Collection.InsertOneAsync(aggregate, cancellationToken: cancellationToken);
    }

    public async Task<bool> UpdateAsync(TAggregate aggregate, CancellationToken cancellationToken = default)
    {
        var expectedVersion = aggregate.Version;
        var filter = Filter.Eq(item => item.Id, aggregate.Id) & Filter.Eq(item => item.Version, expectedVersion);

        aggregate.Version = expectedVersion + 1;
        var result = await Collection.ReplaceOneAsync(filter, aggregate, cancellationToken: cancellationToken);
        if (result.MatchedCount == 1)
        {
            return true;
        }

        aggregate.Version = expectedVersion;
        return false;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var result = await Collection.DeleteOneAsync(Filter.Eq(aggregate => aggregate.Id, id), cancellationToken);
        return result.DeletedCount == 1;
    }
}
