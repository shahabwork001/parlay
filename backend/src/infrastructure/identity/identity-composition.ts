import type { EventPublisher } from "../../application/abstractions/messaging/integration-event.js";
import type { IdentityContext } from "../../application/features/identity/identity-context.js";
import type { ApiConfig } from "../config/config.js";
import { MongoDeviceRepository } from "../persistence/mongo/device-repository.js";
import { MongoUserRepository } from "../persistence/mongo/user-repository.js";
import type { Db } from "mongodb";
import { AesGcmSecretCipher, Argon2PasswordHasher, HmacKeyedHasher } from "./crypto.js";
import { JwtAccessTokenService } from "./jwt-access-tokens.js";
import { MongoOneTimeTokenStore, MongoRefreshTokenStore } from "./mongo-token-stores.js";
import { OtpTotpService } from "./otp-totp-service.js";

const HOUR_MS = 60 * 60 * 1000;

export const TOKEN_ISSUER = "parley";
export const TOKEN_AUDIENCE = "parley-clients";

export function createIdentityContext(
  database: Db,
  events: EventPublisher,
  config: ApiConfig,
): IdentityContext {
  return {
    settings: {
      termsVersion: config.termsVersion,
      lockout: { maxFailedAttempts: 5, lockoutMs: 15 * 60 * 1000 },
      emailVerificationTtlMs: 24 * HOUR_MS,
      passwordResetTtlMs: HOUR_MS,
      frontendUrl: config.frontendUrl,
    },
    clock: () => new Date(),
    users: new MongoUserRepository(database),
    devices: new MongoDeviceRepository(database),
    passwords: new Argon2PasswordHasher(),
    hasher: new HmacKeyedHasher(config.auth.hashSecret),
    accessTokens: new JwtAccessTokenService({
      secret: config.auth.jwtSecret,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      ttlSeconds: config.auth.accessTokenTtlSeconds,
    }),
    refreshTokens: new MongoRefreshTokenStore(database, config.auth.refreshTokenTtlMs),
    oneTimeTokens: new MongoOneTimeTokenStore(database),
    totp: new OtpTotpService("Parley"),
    cipher: new AesGcmSecretCipher(config.auth.totpEncryptionKey),
    events,
  };
}
