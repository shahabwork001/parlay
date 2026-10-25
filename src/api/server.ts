import { createServer } from "node:http";
import { loadApiConfig } from "../infrastructure/config/config.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createApp } from "./app.js";

const SERVICE_NAME = "parley-api";

const config = loadApiConfig();
const logger = createLogger({
  service: SERVICE_NAME,
  level: config.logLevel,
  pretty: config.environment === "development",
});
const infrastructure = await createInfrastructure(config, logger, SERVICE_NAME);

const app = createApp({
  logger,
  corsAllowedOrigins: config.corsAllowedOrigins,
  healthChecks: infrastructure.healthChecks,
  enableApiReference: config.environment === "development",
});

const server = createServer(app);
server.keepAliveTimeout = 65_000;
server.listen(config.port, () => {
  logger.info({ port: config.port }, "API listening");
});

onShutdown(logger, async () => {
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await infrastructure.close();
});
