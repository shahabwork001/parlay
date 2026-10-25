using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Parley.IntegrationTests.Infrastructure;

namespace Parley.IntegrationTests.Api;

public sealed class ParleyApiFactory(InfrastructureFixture fixture) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration(configuration =>
            configuration.AddInMemoryCollection(fixture.ToConfiguration($"parley_api_tests_{Guid.NewGuid():N}")));
    }
}
