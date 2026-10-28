import { createServer } from "node:http";
import { RecordContentFlag } from "../application/features/moderation/content-flags.js";
import { SubmitReport } from "../application/features/moderation/reports.js";
import { RedisRateLimiter } from "../infrastructure/caching/redis-rate-limiter.js";
import { loadApiConfig } from "../infrastructure/config/config.js";
import { createIdentityContext } from "../infrastructure/identity/identity-composition.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { RedisMatchmaker } from "../infrastructure/matchmaking/redis-matchmaker.js";
import { createModerationContext } from "../infrastructure/moderation/moderation-composition.js";
import { HmacTurnCredentialProvider } from "../infrastructure/rtc/turn-credentials.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createApp } from "./app.js";
import { authenticate } from "./auth/authentication.js";
import { registerIdentityOpenApi } from "./features/identity/identity-openapi.js";
import { createIdentityRouter } from "./features/identity/identity-router.js";
import {
  createModerationRouter,
  registerModerationOpenApi,
} from "./features/moderation/moderation-router.js";
import { createRtcRouter, registerRtcOpenApi } from "./features/rtc/rtc-router.js";
import { ChatGateway, DEFAULT_CHAT_RATE_LIMITS } from "./realtime/chat-gateway.js";
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
const moderation = createModerationContext(infrastructure, config);
const clock = () => new Date();

const matchmaker = new RedisMatchmaker(infrastructure.redis, {
  interestFallbackMs: config.matchInterestFallbackMs,
  recentPartnerWindowMs: 60_000,
  scanLimit: 200,
  sessionTtlSeconds: 4 * 60 * 60,
  reportWindowSeconds: 10 * 60,
});

// The gateway exists only once the socket server is attached to the HTTP server; reports reach it
// through this indirection (no request can arrive before the server listens).
const sessionControl = {
  endIfActive: (subjectId: string, sessionId: string) => chat.endIfActive(subjectId, sessionId),
};
const submitReport = new SubmitReport({
  matchmaker,
  sessions: sessionControl,
  recentMessages: moderation.recentMessages,
  reports: moderation.reports,
  evidence: moderation.evidence,
  bans: moderation.bans,
  rateLimiter,
  events: infrastructure.eventPublisher,
  policy: moderation.policy,
  clock,
});

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
    { router: createRtcRouter(new HmacTurnCredentialProvider(config.turn)), openApi: registerRtcOpenApi },
    {
      router: createModerationRouter({
        moderation,
        submitReport,
        hasher: identity.hasher,
        rateLimiter,
        rateLimitMultiplier: config.rateLimitMultiplier,
      }),
      openApi: registerModerationOpenApi,
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
  bans: moderation.bans,
  hasher: identity.hasher,
  trustProxy: config.trustProxy,
  logger: logger.child({ component: "socket" }),
});
const chat = new ChatGateway(sockets.io, {
  matchmaker,
  events: infrastructure.eventPublisher,
  rateLimiter,
  rateLimits: {
    ...DEFAULT_CHAT_RATE_LIMITS,
    matchesPerMinute: DEFAULT_CHAT_RATE_LIMITS.matchesPerMinute * config.rateLimitMultiplier,
    messagesPerSecond: DEFAULT_CHAT_RATE_LIMITS.messagesPerSecond * config.rateLimitMultiplier,
  },
  bans: moderation.bans,
  trust: moderation.trust,
  textRules: moderation.textRules,
  recentMessages: moderation.recentMessages,
  recordContentFlag: new RecordContentFlag(
    moderation.counter,
    moderation.bans,
    infrastructure.eventPublisher,
    moderation.policy,
    clock,
  ),
  policy: moderation.policy,
  logger: logger.child({ component: "chat" }),
  retryIntervalMs: 2000,
  presenceIntervalMs: 10_000,
});
const sweeper = new PresenceSweeper(infrastructure.redis, matchmaker, chat, logger, 10_000);
chat.start();
sweeper.start();
moderation.bans.warmCache().then(
  (count) => {
    logger.info({ count }, "Ban cache warmed");
  },
  (error: unknown) => {
    logger.error({ err: error }, "Warming the ban cache failed");
  },
);

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
