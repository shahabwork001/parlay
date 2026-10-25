import { z } from "zod";

const commaSeparated = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const infrastructureSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MONGO_URI: z.string().startsWith("mongodb"),
  MONGO_DATABASE: z.string().min(1).default("parley"),
  REDIS_URL: z.string().startsWith("redis"),
  RABBITMQ_URL: z.string().startsWith("amqp"),
  RABBITMQ_PREFETCH: z.coerce.number().int().min(1).max(1000).default(16),
  RABBITMQ_DELIVERY_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
  RABBITMQ_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(60_000).default(1000),
});

const apiSchema = infrastructureSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  CORS_ALLOWED_ORIGINS: commaSeparated,
});

const workersSchema = infrastructureSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(8081),
});

export interface InfrastructureConfig {
  readonly environment: "development" | "test" | "production";
  readonly logLevel: string;
  readonly mongo: { readonly uri: string; readonly database: string };
  readonly redis: { readonly url: string };
  readonly rabbitMq: {
    readonly url: string;
    readonly prefetch: number;
    readonly deliveryLimit: number;
    readonly retryDelayMs: number;
  };
}

export interface ApiConfig extends InfrastructureConfig {
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
}

export interface WorkersConfig extends InfrastructureConfig {
  readonly port: number;
}

type Environment = Record<string, string | undefined>;

export class ConfigError extends Error {
  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

function parse<TSchema extends z.ZodType>(schema: TSchema, environment: Environment): z.infer<TSchema> {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  return result.data;
}

function toInfrastructure(values: z.infer<typeof infrastructureSchema>): InfrastructureConfig {
  return {
    environment: values.NODE_ENV,
    logLevel: values.LOG_LEVEL,
    mongo: { uri: values.MONGO_URI, database: values.MONGO_DATABASE },
    redis: { url: values.REDIS_URL },
    rabbitMq: {
      url: values.RABBITMQ_URL,
      prefetch: values.RABBITMQ_PREFETCH,
      deliveryLimit: values.RABBITMQ_DELIVERY_LIMIT,
      retryDelayMs: values.RABBITMQ_RETRY_DELAY_MS,
    },
  };
}

/** Validates the environment once at startup and fails fast with every problem listed. */
export function loadApiConfig(environment: Environment = process.env): ApiConfig {
  const values = parse(apiSchema, environment);
  return { ...toInfrastructure(values), port: values.PORT, corsAllowedOrigins: values.CORS_ALLOWED_ORIGINS };
}

export function loadWorkersConfig(environment: Environment = process.env): WorkersConfig {
  const values = parse(workersSchema, environment);
  return { ...toInfrastructure(values), port: values.PORT };
}
