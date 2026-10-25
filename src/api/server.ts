import { createServer } from "node:http";
import { RedisRateLimiter } from "../infrastructure/caching/redis-rate-limiter.js";
import { loadApiConfig } from "../infrastructure/config/config.js";
import { createIdentityContext } from "../infrastructure/identity/identity-composition.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createApp } from "./app.js";
import { authenticate } from "./auth/authentication.js";
import { registerIdentityOpenApi } from "./features/identity/identity-openapi.js";
import { createIdentityRouter } from "./features/identity/identity-router.js";

const SERVICE_NAME = "parley-api";

const config = loadApiConfig();
const logger = createLogger({
  service: SERVICE_NAME,
  level: config.logLevel,
  pretty: config.environment === "development",
});
const infrastructure = await createInfrastructure(config, logger, SERVICE_NAME);
const identity = createIdentityContext(infrastructure.database, infrastructure.eventPublisher, config);
const rateLimiter = new RedisRateLimiter(infrastructure.redis);

const app = createApp({
  logger,
  corsAllowedOrigins: config.corsAllowedOrigins,
  healthChecks: infrastructure.healthChecks,
  enableApiReference: config.environment === "development",
  trustProxy: config.trustProxy,
  authenticate: authenticate(identity.accessTokens),
  features: [
    {
      router: createIdentityRouter({
        context: identity,
        rateLimiter,
        cookieSecure: config.cookieSecure,
        rateLimitMultiplier: config.rateLimitMultiplier,
      }),
      openApi: registerIdentityOpenApi,
    },
  ],
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
