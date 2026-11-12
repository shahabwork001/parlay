import type { Redis } from "ioredis";
import { type Db, MongoClient } from "mongodb";
import type { EventPublisher } from "../application/abstractions/messaging/integration-event.js";
import { createRedisClient, RedisHealthCheck } from "./caching/redis.js";
import type { InfrastructureConfig } from "./config/config.js";
import type { HealthCheck } from "./health/health-check.js";
import { RabbitMqConnection, RabbitMqHealthCheck } from "./messaging/rabbitmq-connection.js";
import { RabbitMqEventPublisher } from "./messaging/rabbitmq-event-publisher.js";
import type { Logger } from "./observability/logger.js";
import { MongoHealthCheck } from "./persistence/mongo/mongo-health-check.js";
import { TOKEN_INDEXES } from "./identity/mongo-token-stores.js";
import { BLOCK_INDEXES } from "./persistence/mongo/block-repository.js";
import { DEVICE_INDEXES } from "./persistence/mongo/device-repository.js";
import { applyMongoIndexes, type MongoIndexDefinition } from "./persistence/mongo/mongo-indexes.js";
import { USER_INDEXES } from "./persistence/mongo/user-repository.js";
import { AUDIT_INDEXES } from "./moderation/mongo-audit-log.js";
import { BAN_INDEXES } from "./moderation/mongo-ban-repository.js";
import { EVIDENCE_INDEXES } from "./moderation/mongo-evidence-store.js";
import { REPORT_INDEXES } from "./moderation/mongo-report-repository.js";
import { TRUST_INDEXES } from "./moderation/trust-store.js";

/** Every collection's indexes. Features add their definitions here. */
const MONGO_INDEXES: readonly MongoIndexDefinition[] = [
  USER_INDEXES,
  DEVICE_INDEXES,
  BLOCK_INDEXES,
  ...TOKEN_INDEXES,
  REPORT_INDEXES,
  BAN_INDEXES,
  EVIDENCE_INDEXES,
  AUDIT_INDEXES,
  TRUST_INDEXES,
];

/** Composition root for infrastructure shared by the API and the workers. */
export interface Infrastructure {
  readonly database: Db;
  readonly redis: Redis;
  readonly rabbitMq: RabbitMqConnection;
  readonly eventPublisher: EventPublisher;
  readonly healthChecks: readonly HealthCheck[];
  close(): Promise<void>;
}

export async function createInfrastructure(
  config: InfrastructureConfig,
  logger: Logger,
  serviceName: string,
): Promise<Infrastructure> {
  const mongoClient = new MongoClient(config.mongo.uri, {
    appName: serviceName,
    serverSelectionTimeoutMS: 5000,
  });
  const database = mongoClient.db(config.mongo.database);
  const redis = createRedisClient(config.redis.url, logger.child({ component: "redis" }));
  const rabbitMq = await RabbitMqConnection.open(
    config.rabbitMq.url,
    logger.child({ component: "rabbitmq" }),
    serviceName,
  );

  applyMongoIndexes(database, MONGO_INDEXES, logger).catch((error: unknown) => {
    logger.error({ err: error }, "Applying Mongo indexes failed");
  });

  return {
    database,
    redis,
    rabbitMq,
    eventPublisher: new RabbitMqEventPublisher(rabbitMq),
    healthChecks: [
      new MongoHealthCheck(database),
      new RedisHealthCheck(redis),
      new RabbitMqHealthCheck(rabbitMq),
    ],
    async close() {
      await Promise.allSettled([rabbitMq.close(), redis.quit(), mongoClient.close()]);
    },
  };
}
