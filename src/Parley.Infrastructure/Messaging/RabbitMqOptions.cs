using System.ComponentModel.DataAnnotations;

namespace Parley.Infrastructure.Messaging;

public sealed class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    [Required]
    public string Host { get; init; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; init; } = 5672;

    [Required]
    public string Username { get; init; } = string.Empty;

    [Required]
    public string Password { get; init; } = string.Empty;

    public string VirtualHost { get; init; } = "/";

    /// <summary>Number of unacknowledged messages a consumer may hold at once.</summary>
    [Range(1, 1000)]
    public ushort PrefetchCount { get; init; } = 16;

    /// <summary>Deliveries attempted before a failing message is dead-lettered.</summary>
    [Range(1, 100)]
    public int DeliveryLimit { get; init; } = 5;
}
