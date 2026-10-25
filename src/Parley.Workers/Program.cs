using Parley.Application;
using Parley.Infrastructure;
using Parley.Infrastructure.Health;
using Parley.Infrastructure.Observability;

var builder = WebApplication.CreateSlimBuilder(args);

builder.AddParleyObservability("parley-workers");
builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.MapParleyHealthEndpoints();

await app.RunAsync();
