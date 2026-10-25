using Testcontainers.MongoDb;
using Testcontainers.RabbitMq;
using Testcontainers.Redis;

namespace Parley.IntegrationTests.Infrastructure;

/// <summary>Starts disposable MongoDB, Redis and RabbitMQ containers shared by every test in the collection.</summary>
public sealed class InfrastructureFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder().WithImage("mongo:8.0").Build();
    private readonly RedisContainer _redis = new RedisBuilder().WithImage("redis:8-alpine").Build();
    private readonly RabbitMqContainer _rabbitMq = new RabbitMqBuilder().WithImage("rabbitmq:4-management-alpine").Build();

    public string MongoConnectionString => _mongo.GetConnectionString();

    public string RedisConnectionString => _redis.GetConnectionString();

    public Uri RabbitMqUri => new(_rabbitMq.GetConnectionString());

    public IReadOnlyDictionary<string, string?> ToConfiguration(string databaseName)
    {
        var credentials = RabbitMqUri.UserInfo.Split(':');
        return new Dictionary<string, string?>
        {
            ["Mongo:ConnectionString"] = MongoConnectionString,
            ["Mongo:Database"] = databaseName,
            ["Redis:ConnectionString"] = RedisConnectionString,
            ["RabbitMq:Host"] = RabbitMqUri.Host,
            ["RabbitMq:Port"] = RabbitMqUri.Port.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["RabbitMq:Username"] = Uri.UnescapeDataString(credentials[0]),
            ["RabbitMq:Password"] = Uri.UnescapeDataString(credentials[1]),
            ["Cors:AllowedOrigins:0"] = "http://localhost:3000",
        };
    }

    public async ValueTask InitializeAsync() =>
        await Task.WhenAll(_mongo.StartAsync(), _redis.StartAsync(), _rabbitMq.StartAsync());

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
        await _redis.DisposeAsync();
        await _rabbitMq.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class InfrastructureCollection : ICollectionFixture<InfrastructureFixture>
{
    public const string Name = "infrastructure";
}
