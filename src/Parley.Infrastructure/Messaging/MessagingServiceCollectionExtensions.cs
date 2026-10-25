using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Parley.Application.Abstractions.Messaging;

namespace Parley.Infrastructure.Messaging;

public static class MessagingServiceCollectionExtensions
{
    /// <summary>
    /// Subscribes <typeparamref name="THandler"/> to <typeparamref name="TEvent"/>. The queue is named
    /// <c>parley.{subscriber}.{routingKey}</c>, so each subscriber gets its own copy of every event.
    /// </summary>
    public static IServiceCollection AddIntegrationEventConsumer<TEvent, THandler>(
        this IServiceCollection services,
        string subscriber)
        where TEvent : IIntegrationEvent
        where THandler : class, IIntegrationEventHandler<TEvent>
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(subscriber);
        var queueName = $"parley.{subscriber}.{TEvent.RoutingKey}";

        services.AddScoped<IIntegrationEventHandler<TEvent>, THandler>();
        services.AddHostedService(provider => new RabbitMqConsumer<TEvent>(
            queueName,
            provider.GetRequiredService<RabbitMqConnection>(),
            provider.GetRequiredService<IServiceScopeFactory>(),
            provider.GetRequiredService<IOptions<RabbitMqOptions>>(),
            provider.GetRequiredService<ILogger<RabbitMqConsumer<TEvent>>>()));
        return services;
    }
}
