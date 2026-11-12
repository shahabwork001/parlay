import { createServer } from "node:http";
import express from "express";
import { loadWorkersConfig } from "../infrastructure/config/config.js";
import { SmtpEmailSender } from "../infrastructure/email/smtp-email-sender.js";
import { createHealthRouter } from "../infrastructure/health/health-router.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { createModerationContext } from "../infrastructure/moderation/moderation-composition.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { ScoreReport } from "../application/features/moderation/scoring.js";
import { MongoBlockRepository } from "../infrastructure/persistence/mongo/block-repository.js";
import { createConsumers } from "./consumers.js";

const SERVICE_NAME = "parley-workers";

const config = loadWorkersConfig();
const logger = createLogger({
  service: SERVICE_NAME,
  level: config.logLevel,
  pretty: config.environment === "development",
});
const infrastructure = await createInfrastructure(config, logger, SERVICE_NAME);

const emailSender = new SmtpEmailSender(config.smtp);

const moderation = createModerationContext(infrastructure, config);
const recoveryScorer = new ScoreReport({
  ...moderation,
  blocks: new MongoBlockRepository(infrastructure.database),
  clock: () => new Date(),
});
let recovering = false;
const recoveryTimer = setInterval(() => {
  if (recovering) return;
  recovering = true;
  void (async () => {
    for (const reportId of await moderation.reports.pendingScoring()) {
      try {
        await recoveryScorer.handle({
          eventId: `recover:${reportId}`,
          occurredAt: new Date().toISOString(),
          payload: { reportId },
        });
      } catch (error) {
        logger.error({ err: error, reportId }, "Report recovery will retry");
      }
    }
  })()
    .catch((error: unknown) => {
      logger.error({ err: error }, "Report recovery scan failed");
    })
    .finally(() => {
      recovering = false;
    });
}, 10_000);
recoveryTimer.unref();
const consumers = createConsumers({ infrastructure, moderation, config, logger, emailSender });
await Promise.all(consumers.map((consumer) => consumer.start()));

const app = express();
app.disable("x-powered-by");
app.use(createHealthRouter(infrastructure.healthChecks, logger));
const server = createServer(app);
server.listen(config.port, () => {
  logger.info({ port: config.port, consumers: consumers.length }, "Workers running");
});

onShutdown(logger, async () => {
  clearInterval(recoveryTimer);
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await Promise.allSettled(consumers.map((consumer) => consumer.stop()));
  emailSender.close();
  await infrastructure.close();
});
