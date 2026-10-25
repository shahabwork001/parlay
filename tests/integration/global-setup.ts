import { MongoDBContainer } from "@testcontainers/mongodb";
import { RabbitMQContainer } from "@testcontainers/rabbitmq";
import { RedisContainer } from "@testcontainers/redis";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
    redisUrl: string;
    rabbitMqUrl: string;
  }
}

/** Starts disposable MongoDB, Redis and RabbitMQ containers once for the whole integration run. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [mongo, redis, rabbitMq] = await Promise.all([
    new MongoDBContainer("mongo:8.0").start(),
    new RedisContainer("redis:8-alpine").start(),
    new RabbitMQContainer("rabbitmq:4-management-alpine").start(),
  ]);

  project.provide("mongoUri", `${mongo.getConnectionString()}?directConnection=true`);
  project.provide("redisUrl", redis.getConnectionUrl());
  project.provide("rabbitMqUrl", rabbitMq.getAmqpUrl());

  return async () => {
    await Promise.all([mongo.stop(), redis.stop(), rabbitMq.stop()]);
  };
}
