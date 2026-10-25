using Microsoft.Extensions.Diagnostics.HealthChecks;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Parley.Infrastructure.Persistence.Mongo;

internal sealed class MongoHealthCheck(IMongoDatabase database) : IHealthCheck
{
    private static readonly BsonDocumentCommand<BsonDocument> PingCommand = new(new BsonDocument("ping", 1));

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await database.RunCommandAsync(PingCommand, cancellationToken: cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is MongoException or TimeoutException)
        {
            return new HealthCheckResult(context.Registration.FailureStatus, "MongoDB ping failed.", exception);
        }
    }
}
