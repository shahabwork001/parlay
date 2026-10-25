using System.ComponentModel.DataAnnotations;

namespace Parley.Infrastructure.Caching;

public sealed class RedisOptions
{
    public const string SectionName = "Redis";

    /// <summary>StackExchange.Redis configuration string, e.g. <c>localhost:6379,password=...</c>.</summary>
    [Required]
    public string ConnectionString { get; init; } = string.Empty;
}
