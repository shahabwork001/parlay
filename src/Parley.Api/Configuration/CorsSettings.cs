using System.ComponentModel.DataAnnotations;

namespace Parley.Api.Configuration;

public sealed class CorsSettings
{
    public const string SectionName = "Cors";
    public const string PolicyName = "frontend";

    /// <summary>Exact frontend origins allowed to call the API with credentials. No wildcards.</summary>
    [Required]
    [MinLength(1)]
    public string[] AllowedOrigins { get; init; } = [];
}
