/**
 * Loaded with `node --import` before the application so instrumentations can patch modules.
 * Telemetry export is enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set; the service name
 * comes from OTEL_SERVICE_NAME.
 */
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { register, supportsSyncHooks } from "import-in-the-middle/register-hooks.mjs";

const INSTRUMENTED_PACKAGES = ["express", "mongodb", "ioredis", "amqplib"];

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  if (supportsSyncHooks()) {
    register({ include: INSTRUMENTED_PACKAGES });
  } else {
    process.emitWarning(
      "This Node.js version cannot run synchronous loader hooks; ESM modules are not instrumented.",
    );
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => request.url?.startsWith("/health") ?? false,
      }),
      new ExpressInstrumentation(),
      new MongoDBInstrumentation(),
      new IORedisInstrumentation(),
      new AmqplibInstrumentation(),
    ],
  });
  sdk.start();

  const shutdown = () => void sdk.shutdown();
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
