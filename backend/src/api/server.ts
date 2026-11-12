import { UNAVAILABLE_ADULT_ACCESS } from "../application/features/chat/adult-access.js";
import { MongoBlockRepository } from "../infrastructure/persistence/mongo/block-repository.js";
import { MvpInsights } from "../infrastructure/admin/mvp-insights.js";
import { createMvpRouter, registerMvpOpenApi } from "./features/site/mvp-router.js";
import { AgeAssurance } from "../application/features/identity/age-assurance.js";
import {
  MongoAgeVerificationStore,
  unavailableAgeProvider,
} from "../infrastructure/identity/mongo-age-verification.js";
import { createAgeRouter, registerAgeOpenApi } from "./features/identity/age-router.js";
import { BillingService } from "../application/features/billing/billing-service.js";
import { MongoBillingStore } from "../infrastructure/billing/mongo-billing-store.js";
import {
  MockPaymentProvider,
  UnavailablePaymentProvider,
} from "../infrastructure/billing/payment-providers.js";
import { createBillingRouter, registerBillingOpenApi } from "./features/billing/billing-router.js";
import { createServer } from "node:http";
import { RecordContentFlag } from "../application/features/moderation/content-flags.js";
import { SubmitReport } from "../application/features/moderation/reports.js";
import { createAdminContext } from "../infrastructure/admin/admin-composition.js";
import { RedisLiveStats } from "../infrastructure/admin/redis-live-stats.js";
import { RedisRateLimiter } from "../infrastructure/caching/redis-rate-limiter.js";
import type { HealthCheck } from "../infrastructure/health/health-check.js";
import {
  HttpHealthCheck,
  TcpHealthCheck,
  turnTcpEndpoint,
} from "../infrastructure/health/remote-health-checks.js";
import { loadApiConfig } from "../infrastructure/config/config.js";
import { createIdentityContext } from "../infrastructure/identity/identity-composition.js";
import { createInfrastructure } from "../infrastructure/infrastructure.js";
import { MongoSiteConfig } from "../infrastructure/site/mongo-site-config.js";
import { RedisMatchmaker } from "../infrastructure/matchmaking/redis-matchmaker.js";
import { createModerationContext } from "../infrastructure/moderation/moderation-composition.js";
import { HmacTurnCredentialProvider } from "../infrastructure/rtc/turn-credentials.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { onShutdown } from "../infrastructure/process/shutdown.js";
import { createApp } from "./app.js";
import { authenticate } from "./auth/authentication.js";
import { registerIdentityOpenApi } from "./features/identity/identity-openapi.js";
import { createAdminRouter } from "./features/admin/admin-router.js";
import { registerAdminOpenApi } from "./features/admin/admin-openapi.js";
import { createIdentityRouter } from "./features/identity/identity-router.js";
import {
  createModerationRouter,
  registerModerationOpenApi,
} from "./features/moderation/moderation-router.js";
import { createRtcRouter, registerRtcOpenApi } from "./features/rtc/rtc-router.js";
import { createSiteRouter, registerSiteOpenApi } from "./features/site/site-router.js";
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
const insights = new MvpInsights(infrastructure.database, identity.hasher);
await insights.initialize();
const ageStore = new MongoAgeVerificationStore(infrastructure.database);
await ageStore.initialize();
const ageAssurance = new AgeAssurance(ageStore, unavailableAgeProvider, moderation.audit);
const billingStore = new MongoBillingStore(infrastructure.database, config.billing.priceMinor);
await billingStore.initialize();
const paymentProvider =
  config.billing.provider === "mock" && config.environment === "test"
    ? new MockPaymentProvider(config.environment, config.billing.mockSecret ?? "")
    : new UnavailablePaymentProvider();
const billing = new BillingService(
  billingStore,
  paymentProvider,
  config.environment === "production",
  `${config.frontendUrl}/subscription`,
);
let reconcilingBilling = false;
const billingTimer = setInterval(() => {
  if (!billing.checkoutEnabled || reconcilingBilling) return;
  reconcilingBilling = true;
  void billing
    .reconcile()
    .catch((error: unknown) => {
      logger.error({ err: error }, "Billing reconciliation failed");
    })
    .finally(() => {
      reconcilingBilling = false;
    });
}, 30_000);
billingTimer.unref();
const liveStats = new RedisLiveStats(infrastructure.redis);
const siteConfig = new MongoSiteConfig(infrastructure.database);
const admin = createAdminContext(infrastructure, moderation, identity, liveStats);

/** The admin system view also covers TURN (TCP reachability) and the workers process. */
const systemChecks: HealthCheck[] = [...infrastructure.healthChecks];
const turnEndpoint = turnTcpEndpoint(config.turn.turnUrls);
if (turnEndpoint)
  systemChecks.push(
    new TcpHealthCheck("turn", config.health.turnHost ?? turnEndpoint.host, turnEndpoint.port),
  );
if (config.health.workersUrl) systemChecks.push(new HttpHealthCheck("workers", config.health.workersUrl));

await new MongoBlockRepository(infrastructure.database).restore(infrastructure.redis);
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
  onDeferredFailure: (error) => {
    logger.warn({ err: error }, "Report accepted; unfinished effects will be recovered by workers");
  },
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
    { router: createMvpRouter(insights, rateLimiter), openApi: registerMvpOpenApi },
    { router: createAgeRouter(ageAssurance), openApi: registerAgeOpenApi },
    { router: createBillingRouter(billing, moderation.audit, rateLimiter), openApi: registerBillingOpenApi },
    {
      router: createIdentityRouter({
        context: identity,
        rateLimiter,
        cookieSecure: config.cookieSecure,
        rateLimitMultiplier: config.rateLimitMultiplier,
        siteConfig,
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
    {
      router: createAdminRouter({ context: admin, healthChecks: systemChecks }),
      openApi: registerAdminOpenApi,
    },
    { router: createSiteRouter({ siteConfig, audit: moderation.audit }), openApi: registerSiteOpenApi },
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
  siteConfig,
  hasher: identity.hasher,
  trustProxy: config.trustProxy,
  logger: logger.child({ component: "socket" }),
});
const chat = new ChatGateway(sockets.io, {
  adultAccess: config.adultChatEnabled ? ageAssurance : UNAVAILABLE_ADULT_ACCESS,
  metrics: insights,
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
  matchStats: liveStats,
  siteConfig,
  logger: logger.child({ component: "chat" }),
  retryIntervalMs: 2000,
  presenceIntervalMs: 10_000,
});
const sweeper = new PresenceSweeper(infrastructure.redis, matchmaker, chat, logger, 10_000);
chat.start();
sweeper.start();
const warmedBanCount = await moderation.bans.warmCache();
logger.info({ count: warmedBanCount }, "Ban cache warmed before accepting traffic");

server.listen(config.port, () => {
  logger.info({ port: config.port }, "API listening");
});

onShutdown(logger, async () => {
  clearInterval(billingTimer);
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
