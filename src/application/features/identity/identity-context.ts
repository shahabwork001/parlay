import type { LockoutPolicy } from "../../../domain/identity/user.js";
import type { EventPublisher } from "../../abstractions/messaging/integration-event.js";
import type {
  AccessTokenService,
  Clock,
  DeviceRepository,
  KeyedHasher,
  OneTimeTokenStore,
  PasswordHasher,
  RefreshTokenStore,
  SecretCipher,
  TotpService,
  UserRepository,
} from "./ports.js";

export interface IdentitySettings {
  /** Current Terms and Community Guidelines version; anything else must be re-accepted. */
  readonly termsVersion: string;
  readonly lockout: LockoutPolicy;
  readonly emailVerificationTtlMs: number;
  readonly passwordResetTtlMs: number;
  /** Public frontend origin used to build links in emails. */
  readonly frontendUrl: string;
}

/** Everything identity use cases depend on, assembled once in the composition root. */
export interface IdentityContext {
  readonly settings: IdentitySettings;
  readonly clock: Clock;
  readonly users: UserRepository;
  readonly devices: DeviceRepository;
  readonly passwords: PasswordHasher;
  readonly hasher: KeyedHasher;
  readonly accessTokens: AccessTokenService;
  readonly refreshTokens: RefreshTokenStore;
  readonly oneTimeTokens: OneTimeTokenStore;
  readonly totp: TotpService;
  readonly cipher: SecretCipher;
  readonly events: EventPublisher;
}
