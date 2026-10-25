using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Parley.Infrastructure.Persistence.Mongo;

internal sealed partial class MongoIndexInitializer(
    IMongoDatabase database,
    IEnumerable<IMongoIndexDefinition> definitions,
    ILogger<MongoIndexInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        foreach (var definition in definitions)
        {
            await definition.ApplyAsync(database, cancellationToken);
            LogIndexesApplied(definition.CollectionName);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Information, Message = "Mongo indexes applied for collection {Collection}")]
    private partial void LogIndexesApplied(string collection);
}
