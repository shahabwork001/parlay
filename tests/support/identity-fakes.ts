import { randomUUID } from "node:crypto";
import type {
  EventPublisher,
  IntegrationEventDefinition,
} from "../../src/application/abstractions/messaging/integration-event.js";
import { UniqueConstraintViolationError } from "../../src/application/abstractions/persistence/errors.js";
import type {
  IdentityContext,
  IdentitySettings,
} from "../../src/application/features/identity/identity-context.js";
import type {
  DeviceRepository,
  IssuedToken,
  KeyedHasher,
  OneTimeTokenPurpose,
  OneTimeTokenStore,
  PasswordHasher,
  RefreshRotation,
  RefreshSession,
  RefreshTokenStore,
  SecretCipher,
  TotpService,
  UserRepository,
} from "../../src/application/features/identity/ports.js";
import type { AggregateRoot } from "../../src/domain/common/aggregate-root.js";
import type { Device } from "../../src/domain/identity/device.js";
import type { SiteConfigProvider } from "../../src/application/features/site/site-config.js";
import type { Role } from "../../src/domain/identity/roles.js";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "../../src/domain/site/site-config.js";
import type { User } from "../../src/domain/identity/user.js";
import { JwtAccessTokenService } from "../../src/infrastructure/identity/jwt-access-tokens.js";

/** In-memory repository with the same optimistic-concurrency semantics as the Mongo one. */
export class InMemoryRepository<T extends AggregateRoot> {
  protected readonly items = new Map<string, { version: number; value: T }>();

  getById(id: string): Promise<T | null> {
    return Promise.resolve(this.items.get(id)?.value ?? null);
  }

  add(aggregate: T): Promise<void> {
    aggregate.version = 1;
    this.items.set(aggregate.id, { version: 1, value: aggregate });
    return Promise.resolve();
  }

  update(aggregate: T): Promise<boolean> {
    const stored = this.items.get(aggregate.id);
    if (stored?.version !== aggregate.version) return Promise.resolve(false);
    aggregate.version += 1;
    this.items.set(aggregate.id, { version: aggregate.version, value: aggregate });
    return Promise.resolve(true);
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.items.delete(id));
  }

  all(): T[] {
    return [...this.items.values()].map((item) => item.value);
  }
}

export class InMemoryUsers extends InMemoryRepository<User> implements UserRepository {
  override add(user: User): Promise<void> {
    if (this.all().some((existing) => existing.email === user.email)) {
      return Promise.reject(new UniqueConstraintViolationError("users.email"));
    }
    return super.add(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.all().find((user) => user.email === email) ?? null);
  }

  countWithRole(role: Role): Promise<number> {
    return Promise.resolve(this.all().filter((user) => user.roles.includes(role)).length);
  }
}

export class InMemoryDevices extends InMemoryRepository<Device> implements DeviceRepository {
  findByFingerprintHash(fingerprintHash: string): Promise<Device | null> {
    return Promise.resolve(this.all().find((device) => device.fingerprintHash === fingerprintHash) ?? null);
  }
}

export const fakePasswords: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: (hash, password) => Promise.resolve(hash === `hashed:${password}`),
};

export const fakeHasher: KeyedHasher = { hash: (purpose, value) => `${purpose}#${value}` };

export const fakeCipher: SecretCipher = {
  encrypt: (plaintext) => `enc:${plaintext}`,
  decrypt: (ciphertext) => ciphertext.replace(/^enc:/, ""),
};

export const VALID_TOTP = "123456";

export const fakeTotp: TotpService = {
  generateSecret: () => "SECRET",
  buildUri: (secret, account) => `otpauth://totp/Parley:${account}?secret=${secret}`,
  verify: (_secret, code) => code === VALID_TOTP,
  generateRecoveryCodes: () => ["aaaaa-11111", "bbbbb-22222"],
};

export class InMemoryRefreshTokens implements RefreshTokenStore {
  readonly tokens = new Map<string, { session: RefreshSession; used: boolean }>();

  issue(session: RefreshSession): Promise<IssuedToken> {
    const token = randomUUID();
    this.tokens.set(token, { session, used: false });
    return Promise.resolve({ token, expiresAt: new Date(Date.now() + 86_400_000) });
  }

  async rotate(token: string): Promise<RefreshRotation> {
    const entry = this.tokens.get(token);
    if (!entry) return { status: "invalid" };
    if (entry.used) {
      this.revokeFamily(entry.session.familyId);
      return { status: "reused" };
    }
    entry.used = true;
    return { status: "rotated", session: entry.session, refreshToken: await this.issue(entry.session) };
  }

  revokeByToken(token: string): Promise<void> {
    const entry = this.tokens.get(token);
    if (entry) this.revokeFamily(entry.session.familyId);
    return Promise.resolve();
  }

  revokeAllForSubject(subjectId: string): Promise<void> {
    for (const [token, entry] of this.tokens) {
      if (entry.session.subject.id === subjectId) this.tokens.delete(token);
    }
    return Promise.resolve();
  }

  private revokeFamily(familyId: string): void {
    for (const [token, entry] of this.tokens) {
      if (entry.session.familyId === familyId) this.tokens.delete(token);
    }
  }
}

export class InMemoryOneTimeTokens implements OneTimeTokenStore {
  readonly tokens = new Map<string, { purpose: OneTimeTokenPurpose; userId: string }>();

  create(purpose: OneTimeTokenPurpose, userId: string): Promise<string> {
    const token = `ott-${randomUUID()}`;
    this.tokens.set(token, { purpose, userId });
    return Promise.resolve(token);
  }

  consume(purpose: OneTimeTokenPurpose, token: string): Promise<string | null> {
    const entry = this.tokens.get(token);
    if (entry?.purpose !== purpose) return Promise.resolve(null);
    this.tokens.delete(token);
    return Promise.resolve(entry.userId);
  }
}

export class RecordingEvents implements EventPublisher {
  readonly published: { routingKey: string; payload: unknown }[] = [];

  publish<TPayload>(definition: IntegrationEventDefinition<TPayload>, payload: TPayload): Promise<void> {
    this.published.push({ routingKey: definition.routingKey, payload: definition.schema.parse(payload) });
    return Promise.resolve();
  }
}

export const TEST_TERMS_VERSION = "2026-10-25";

export const testSettings: IdentitySettings = {
  termsVersion: TEST_TERMS_VERSION,
  lockout: { maxFailedAttempts: 3, lockoutMs: 60_000 },
  emailVerificationTtlMs: 60_000,
  passwordResetTtlMs: 60_000,
  frontendUrl: "http://localhost:3000",
};

export interface TestIdentity extends IdentityContext {
  readonly users: InMemoryUsers;
  readonly devices: InMemoryDevices;
  readonly refreshTokens: InMemoryRefreshTokens;
  readonly oneTimeTokens: InMemoryOneTimeTokens;
  readonly events: RecordingEvents;
  now: Date;
}

export function createTestIdentity(): TestIdentity {
  const identity: TestIdentity = {
    settings: testSettings,
    now: new Date("2026-10-25T12:00:00Z"),
    clock: () => identity.now,
    users: new InMemoryUsers(),
    devices: new InMemoryDevices(),
    passwords: fakePasswords,
    hasher: fakeHasher,
    accessTokens: new JwtAccessTokenService({
      secret: "test-secret-that-is-long-enough-123",
      issuer: "parley",
      audience: "parley-clients",
      ttlSeconds: 900,
    }),
    refreshTokens: new InMemoryRefreshTokens(),
    oneTimeTokens: new InMemoryOneTimeTokens(),
    totp: fakeTotp,
    cipher: fakeCipher,
    events: new RecordingEvents(),
  };
  return identity;
}

/** Extracts the token from the last email link sent to `to`. */
export function lastEmailToken(identity: TestIdentity, to: string): string {
  const email = identity.events.published
    .map((event) => event.payload as { to: string; link?: string })
    .filter((payload) => payload.to === to)
    .at(-1);
  const token = email?.link ? new URL(email.link).searchParams.get("token") : null;
  if (!token) throw new Error(`No email with a token was sent to ${to}.`);
  return token;
}

/** A site configuration that tests can change (maintenance, feature flags). */
export class MutableSiteConfig implements SiteConfigProvider {
  config: SiteConfig = DEFAULT_SITE_CONFIG;

  current(): Promise<SiteConfig> {
    return Promise.resolve(this.config);
  }
}
