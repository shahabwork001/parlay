using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Parley.Application.Abstractions.Messaging;
using Parley.Infrastructure.Caching;
using Parley.Infrastructure.Health;
using Parley.Infrastructure.Messaging;
using Parley.Infrastructure.Persistence.Mongo;
using StackExchange.Redis;

namespace Parley.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(TimeProvider.System);

        services.AddMongo(configuration);
        services.AddRedis(configuration);
        services.AddRabbitMq(configuration);

        services.AddHealthChecks()
            .AddCheck<MongoHealthCheck>("mongodb", tags: [HealthEndpointExtensions.ReadinessTag], timeout: TimeSpan.FromSeconds(3))
            .AddCheck<RedisHealthCheck>("redis", tags: [HealthEndpointExtensions.ReadinessTag], timeout: TimeSpan.FromSeconds(3))
            .AddCheck<RabbitMqHealthCheck>("rabbitmq", tags: [HealthEndpointExtensions.ReadinessTag], timeout: TimeSpan.FromSeconds(3));

        return services;
    }

    private static void AddMongo(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<MongoOptions>()
            .Bind(configuration.GetSection(MongoOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        MongoConventions.Register();
        services.AddSingleton<IMongoClient>(provider =>
        {
            var options = provider.GetRequiredService<IOptions<MongoOptions>>().Value;
            var settings = MongoClientSettings.FromConnectionString(options.ConnectionString);
            settings.ApplicationName = "parley";
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            return new MongoClient(settings);
        });
        services.AddSingleton(provider =>
        {
            var options = provider.GetRequiredService<IOptions<MongoOptions>>().Value;
            return provider.GetRequiredService<IMongoClient>().GetDatabase(options.Database);
        });
        services.AddHostedService<MongoIndexInitializer>();
    }

    private static void AddRedis(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RedisOptions>()
            .Bind(configuration.GetSection(RedisOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<IConnectionMultiplexer>(provider =>
        {
            var options = provider.GetRequiredService<IOptions<RedisOptions>>().Value;
            var redisConfiguration = ConfigurationOptions.Parse(options.ConnectionString);
            redisConfiguration.AbortOnConnectFail = false;
            redisConfiguration.ClientName = "parley";
            return ConnectionMultiplexer.Connect(redisConfiguration);
        });
    }

    private static void AddRabbitMq(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RabbitMqOptions>()
            .Bind(configuration.GetSection(RabbitMqOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<RabbitMqConnection>();
        services.AddSingleton<IEventPublisher, RabbitMqEventPublisher>();
    }
}
