using Microsoft.Extensions.Diagnostics.HealthChecks;
using RabbitMQ.Client.Exceptions;

namespace Parley.Infrastructure.Messaging;

internal sealed class RabbitMqHealthCheck(RabbitMqConnection connection) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var brokerConnection = await connection.GetAsync(cancellationToken);
            return brokerConnection.IsOpen
                ? HealthCheckResult.Healthy()
                : new HealthCheckResult(context.Registration.FailureStatus, "RabbitMQ connection is closed.");
        }
        catch (Exception exception) when (exception is BrokerUnreachableException or OperationInterruptedException or IOException)
        {
            return new HealthCheckResult(context.Registration.FailureStatus, "RabbitMQ is unreachable.", exception);
        }
    }
}
