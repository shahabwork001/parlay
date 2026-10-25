using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Parley.Application.Abstractions.Messaging;
using Parley.Infrastructure.Messaging;
using Parley.IntegrationTests.Infrastructure;

namespace Parley.IntegrationTests.Messaging;

[Collection(InfrastructureCollection.Name)]
public sealed class RabbitMqMessagingTests(InfrastructureFixture fixture)
{
    public sealed record PingEvent(Guid EventId, DateTimeOffset OccurredAt, string Payload) : IIntegrationEvent
    {
        public static string RoutingKey => "tests.ping.v1";
    }

    public sealed class PingRecorder
    {
        public TaskCompletionSource<PingEvent> Received { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int Attempts { get; set; }
    }

    public sealed class RecordingHandler(PingRecorder recorder) : IIntegrationEventHandler<PingEvent>
    {
        public Task HandleAsync(PingEvent integrationEvent, CancellationToken cancellationToken)
        {
            recorder.Attempts++;
            if (integrationEvent.Payload == "fail-once" && recorder.Attempts == 1)
            {
                throw new InvalidOperationException("Transient failure");
            }

            recorder.Received.TrySetResult(integrationEvent);
            return Task.CompletedTask;
        }
    }

    [Theory]
    [InlineData("hello")]
    [InlineData("fail-once")]
    public async Task Published_event_is_delivered_to_subscribed_handler(string payload)
    {
        var recorder = new PingRecorder();
        using var host = ServiceProviderFactory.CreateHost(fixture, services =>
        {
            services.AddSingleton(recorder);
            services.AddIntegrationEventConsumer<PingEvent, RecordingHandler>($"tests-{Guid.NewGuid():N}");
        });
        await host.StartAsync(TestContext.Current.CancellationToken);
        await Task.Delay(TimeSpan.FromSeconds(1), TestContext.Current.CancellationToken);

        var sent = new PingEvent(Guid.CreateVersion7(), DateTimeOffset.UtcNow, payload);
        await host.Services.GetRequiredService<IEventPublisher>().PublishAsync(sent, TestContext.Current.CancellationToken);

        var received = await recorder.Received.Task.WaitAsync(TimeSpan.FromSeconds(15), TestContext.Current.CancellationToken);
        received.Should().Be(sent);
        await host.StopAsync(TestContext.Current.CancellationToken);
    }
}
