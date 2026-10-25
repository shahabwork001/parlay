import { createServer } from "node:http";
import express from "express";
import { loadWorkersConfig } from "../infrastructure/config/config.js";
import { createHealthRouter } from "../infrastructure/health/health-router.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createConsumers } from "./consumers.js";

const SERVICE_NAME = "parley-workers";

const config = loadWorkersConfig();
const logger = createLogger({
  service: SERVICE_NAME,
  level: config.logLevel,
  pretty: config.environment === "development",
});
const infrastructure = await createInfrastructure(config, logger, SERVICE_NAME);

const consumers = createConsumers(infrastructure, config, logger);
await Promise.all(consumers.map((consumer) => consumer.start()));

const app = express();
app.disable("x-powered-by");
app.use(createHealthRouter(infrastructure.healthChecks, logger));
const server = createServer(app);
server.listen(config.port, () => {
  logger.info({ port: config.port, consumers: consumers.length }, "Workers running");
});

onShutdown(logger, async () => {
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await Promise.allSettled(consumers.map((consumer) => consumer.stop()));
  await infrastructure.close();
});
