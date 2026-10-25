using Parley.Api.Configuration;
using Parley.Application;
using Parley.Infrastructure;
using Parley.Infrastructure.Observability;

var builder = WebApplication.CreateBuilder(args);

builder.AddParleyObservability("parley-api");
builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddApi(builder.Configuration);

var app = builder.Build();

app.UseApiPipeline();
app.MapApiEndpoints();

await app.RunAsync();

public partial class Program;
