using Parley.Api.Middleware;
using Parley.Infrastructure.Health;
using Scalar.AspNetCore;
using Serilog;

namespace Parley.Api.Configuration;

internal static class ApiPipelineExtensions
{
    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseMiddleware<SecurityHeadersMiddleware>();

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }

        app.UseSerilogRequestLogging(options =>
            options.GetLevel = (context, _, exception) => exception is not null || context.Response.StatusCode >= 500
                ? Serilog.Events.LogEventLevel.Error
                : context.Request.Path.StartsWithSegments("/health")
                    ? Serilog.Events.LogEventLevel.Verbose
                    : Serilog.Events.LogEventLevel.Information);

        app.UseResponseCompression();
        app.UseCors(CorsSettings.PolicyName);

        return app;
    }

    public static WebApplication MapApiEndpoints(this WebApplication app)
    {
        app.MapParleyHealthEndpoints();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference(options => options.WithTitle("Parley API"));
        }

        return app;
    }
}
