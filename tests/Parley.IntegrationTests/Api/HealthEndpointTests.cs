using System.Net;
using System.Net.Http.Json;
using Parley.IntegrationTests.Infrastructure;

namespace Parley.IntegrationTests.Api;

[Collection(InfrastructureCollection.Name)]
public sealed class HealthEndpointTests(InfrastructureFixture fixture) : IAsyncDisposable
{
    private readonly ParleyApiFactory _factory = new(fixture);

    private sealed record HealthCheckDto(string Name, string Status);

    private sealed record HealthReportDto(string Status, IReadOnlyList<HealthCheckDto> Checks);

    [Fact]
    public async Task Liveness_reports_healthy_without_dependency_checks()
    {
        using var client = _factory.CreateClient();

        var report = await client.GetFromJsonAsync<HealthReportDto>("/health/live", TestContext.Current.CancellationToken);

        report!.Status.Should().Be("Healthy");
        report.Checks.Should().BeEmpty();
    }

    [Fact]
    public async Task Readiness_reports_every_dependency_healthy()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health/ready", TestContext.Current.CancellationToken);
        var report = await response.Content.ReadFromJsonAsync<HealthReportDto>(TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        report!.Status.Should().Be("Healthy");
        report.Checks.Select(check => check.Name).Should().BeEquivalentTo("mongodb", "redis", "rabbitmq");
        report.Checks.Should().OnlyContain(check => check.Status == "Healthy");
    }

    [Fact]
    public async Task Responses_carry_security_headers()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health/live", TestContext.Current.CancellationToken);

        response.Headers.GetValues("X-Content-Type-Options").Should().ContainSingle("nosniff");
        response.Headers.GetValues("X-Frame-Options").Should().ContainSingle("DENY");
        response.Headers.Contains("Content-Security-Policy").Should().BeTrue();
    }

    [Fact]
    public async Task Unknown_routes_return_problem_details()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/does-not-exist", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task Cors_allows_only_the_configured_frontend_origin()
    {
        using var client = _factory.CreateClient();

        var allowed = await SendPreflightAsync(client, "http://localhost:3000");
        var denied = await SendPreflightAsync(client, "https://evil.example");

        allowed.Headers.GetValues("Access-Control-Allow-Origin").Should().ContainSingle("http://localhost:3000");
        denied.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
    }

    public async ValueTask DisposeAsync() => await _factory.DisposeAsync();

    private static async Task<HttpResponseMessage> SendPreflightAsync(HttpClient client, string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/health/live");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
