using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Formatting.Compact;

namespace Parley.Infrastructure.Observability;

public static class ObservabilityExtensions
{
    private const string OtlpEndpointKey = "OTEL_EXPORTER_OTLP_ENDPOINT";

    /// <summary>
    /// Structured logging (Serilog, compact JSON outside Development) plus OpenTelemetry traces and metrics.
    /// The OTLP exporter is enabled only when <c>OTEL_EXPORTER_OTLP_ENDPOINT</c> is configured.
    /// </summary>
    public static WebApplicationBuilder AddParleyObservability(this WebApplicationBuilder builder, string serviceName)
    {
        var isDevelopment = builder.Environment.IsDevelopment();
        builder.Services.AddSerilog((services, logger) =>
        {
            logger
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(services)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Service", serviceName);

            if (isDevelopment)
            {
                logger.WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}");
            }
            else
            {
                logger.WriteTo.Console(new RenderedCompactJsonFormatter());
            }
        });

        var exportOtlp = !string.IsNullOrWhiteSpace(builder.Configuration[OtlpEndpointKey]);
        var telemetry = builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation(options => options.Filter = context =>
                    !context.Request.Path.StartsWithSegments("/health"))
                .AddHttpClientInstrumentation()
                .AddSource(serviceName))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMeter(serviceName));

        if (exportOtlp)
        {
            telemetry.UseOtlpExporter();
        }

        return builder;
    }
}
