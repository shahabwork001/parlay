import { z } from "zod";

const commaSeparatedUrls = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const iceUrls = (scheme: "stun" | "turn") =>
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(new RegExp(`^${scheme}s?:\\S+$`), `Use ${scheme}: URLs.`)));

const booleanFlag = z.enum(["true", "false"]).transform((value) => value === "true");

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters.`);

const base64Key = z
  .string()
  .refine((value) => Buffer.from(value, "base64").length === 32, "Must be 32 bytes encoded as base64.");

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
  CORS_ALLOWED_ORIGINS: commaSeparatedUrls,
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  TRUST_PROXY: z.string().default("loopback"),
  COOKIE_SECURE: booleanFlag.default(true),
  JWT_SECRET: secret("JWT_SECRET"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  HASH_SECRET: secret("HASH_SECRET"),
  TOTP_ENCRYPTION_KEY: base64Key,
  TERMS_VERSION: z.string().min(1).max(32).default("2026-10-25"),
  RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(1000).default(1),
  MATCH_INTEREST_FALLBACK_MS: z.coerce.number().int().min(0).max(60_000).default(5000),
  TURN_SECRET: z.string().min(16, "TURN_SECRET must be at least 16 characters."),
  TURN_URLS: iceUrls("turn").pipe(z.array(z.string()).min(1)),
  STUN_URLS: iceUrls("stun").default([]),
  TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
});

const workersSchema = infrastructureSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(8081),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: booleanFlag.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Parley <no-reply@parley.local>"),
});

const seedSchema = infrastructureSchema.extend({
  SEED_ADMIN_EMAIL: z.email().default("admin@parley.local"),
  SEED_PRINT_CREDENTIALS: booleanFlag.default(false),
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
  readonly frontendUrl: string;
  /** Express `trust proxy` setting, so `req.ip` is the client address behind load balancers. */
  readonly trustProxy: string;
  readonly cookieSecure: boolean;
  readonly auth: {
    readonly jwtSecret: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlMs: number;
    readonly hashSecret: string;
    readonly totpEncryptionKey: string;
  };
  readonly termsVersion: string;
  /** Scales every rate limit (1 in production; raised for local end-to-end test runs). */
  readonly rateLimitMultiplier: number;
  /** Wait before someone with interests may be matched with anyone. */
  readonly matchInterestFallbackMs: number;
  readonly turn: {
    readonly secret: string;
    readonly turnUrls: readonly string[];
    readonly stunUrls: readonly string[];
    readonly ttlSeconds: number;
  };
}

export interface WorkersConfig extends InfrastructureConfig {
  readonly port: number;
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly user: string | undefined;
    readonly password: string | undefined;
    readonly from: string;
  };
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
  return {
    ...toInfrastructure(values),
    port: values.PORT,
    corsAllowedOrigins: values.CORS_ALLOWED_ORIGINS,
    frontendUrl: values.FRONTEND_URL.replace(/\/$/, ""),
    trustProxy: values.TRUST_PROXY,
    cookieSecure: values.COOKIE_SECURE,
    auth: {
      jwtSecret: values.JWT_SECRET,
      accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlMs: values.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      hashSecret: values.HASH_SECRET,
      totpEncryptionKey: values.TOTP_ENCRYPTION_KEY,
    },
    termsVersion: values.TERMS_VERSION,
    rateLimitMultiplier: values.RATE_LIMIT_MULTIPLIER,
    matchInterestFallbackMs: values.MATCH_INTEREST_FALLBACK_MS,
    turn: {
      secret: values.TURN_SECRET,
      turnUrls: values.TURN_URLS,
      stunUrls: values.STUN_URLS,
      ttlSeconds: values.TURN_CREDENTIAL_TTL_SECONDS,
    },
  };
}

export function loadWorkersConfig(environment: Environment = process.env): WorkersConfig {
  const values = parse(workersSchema, environment);
  return {
    ...toInfrastructure(values),
    port: values.PORT,
    smtp: {
      host: values.SMTP_HOST,
      port: values.SMTP_PORT,
      secure: values.SMTP_SECURE,
      user: values.SMTP_USER,
      password: values.SMTP_PASSWORD,
      from: values.EMAIL_FROM,
    },
  };
}

export interface SeedConfig extends InfrastructureConfig {
  readonly adminEmail: string;
  /** Print the generated SuperAdmin password once (local development only). */
  readonly printCredentials: boolean;
}

export function loadSeedConfig(environment: Environment = process.env): SeedConfig {
  const values = parse(seedSchema, environment);
  return {
    ...toInfrastructure(values),
    adminEmail: values.SEED_ADMIN_EMAIL,
    printCredentials: values.SEED_PRINT_CREDENTIALS,
  };
}
