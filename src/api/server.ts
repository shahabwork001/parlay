import { createServer } from "node:http";
import { RedisRateLimiter } from "../infrastructure/caching/redis-rate-limiter.js";
import { loadApiConfig } from "../infrastructure/config/config.js";
import { createIdentityContext } from "../infrastructure/identity/identity-composition.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { RedisMatchmaker } from "../infrastructure/matchmaking/redis-matchmaker.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createApp } from "./app.js";
import { authenticate } from "./auth/authentication.js";
import { registerIdentityOpenApi } from "./features/identity/identity-openapi.js";
import { createIdentityRouter } from "./features/identity/identity-router.js";
import { ChatGateway } from "./realtime/chat-gateway.js";
import { PresenceSweeper } from "./realtime/presence-sweeper.js";
import { createSocketServer } from "./realtime/socket-server.js";

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

const sockets = createSocketServer(server, {
  corsAllowedOrigins: config.corsAllowedOrigins,
  redisUrl: config.redis.url,
  accessTokens: identity.accessTokens,
  termsVersion: config.termsVersion,
  logger: logger.child({ component: "socket" }),
});
const matchmaker = new RedisMatchmaker(infrastructure.redis, {
  interestFallbackMs: config.matchInterestFallbackMs,
  recentPartnerWindowMs: 60_000,
  scanLimit: 200,
  sessionTtlSeconds: 4 * 60 * 60,
});
const chat = new ChatGateway(sockets.io, {
  matchmaker,
  events: infrastructure.eventPublisher,
  logger: logger.child({ component: "chat" }),
  retryIntervalMs: 2000,
  presenceIntervalMs: 10_000,
});
const sweeper = new PresenceSweeper(infrastructure.redis, matchmaker, chat, logger, 10_000);
chat.start();
sweeper.start();

server.listen(config.port, () => {
  logger.info({ port: config.port }, "API listening");
});

onShutdown(logger, async () => {
  sweeper.stop();
  chat.stop();
  await sockets.close();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await infrastructure.close();
});
