using System.Text.Json;

namespace Parley.Infrastructure.Messaging;

internal static class IntegrationEventSerializer
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static byte[] Serialize<TEvent>(TEvent integrationEvent) =>
        JsonSerializer.SerializeToUtf8Bytes(integrationEvent, Options);

    public static TEvent? Deserialize<TEvent>(ReadOnlyMemory<byte> body) =>
        JsonSerializer.Deserialize<TEvent>(body.Span, Options);
}
