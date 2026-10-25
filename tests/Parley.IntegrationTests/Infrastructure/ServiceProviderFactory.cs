using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Parley.Infrastructure;

namespace Parley.IntegrationTests.Infrastructure;

internal static class ServiceProviderFactory
{
    public static IHost CreateHost(InfrastructureFixture fixture, Action<IServiceCollection>? configure = null)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            EnvironmentName = Environments.Development,
            ApplicationName = "parley-integration-tests",
        });
        builder.Configuration.AddInMemoryCollection(fixture.ToConfiguration($"parley_tests_{Guid.NewGuid():N}"));
        builder.Logging.ClearProviders();
        builder.Services.AddInfrastructure(builder.Configuration);
        configure?.Invoke(builder.Services);
        return builder.Build();
    }
}
