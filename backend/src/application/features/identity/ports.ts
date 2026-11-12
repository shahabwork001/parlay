import type { EntityId } from "../../../domain/common/entity.js";
import type { Device } from "../../../domain/identity/device.js";
import type { Role } from "../../../domain/identity/roles.js";
import type { User } from "../../../domain/identity/user.js";
import type { Repository } from "../../abstractions/persistence/repository.js";

export type Clock = () => Date;

export interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>;
  countWithRole(role: Role): Promise<number>;
}

export interface DeviceRepository extends Repository<Device> {
  findByFingerprintHash(fingerprintHash: string): Promise<Device | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

/** Keyed one-way hashing (HMAC) with domain separation, for values we must match but never store raw. */
export interface KeyedHasher {
  hash(purpose: "device" | "ip" | "recovery-code", value: string): string;
}

/** Who is calling. Carried in the access token and rebuilt from storage on every refresh. */
export interface Principal {
  readonly kind: "user" | "anonymous";
  /** User id for accounts, device id for anonymous sessions. */
  readonly subjectId: EntityId;
  readonly deviceId: EntityId;
  readonly roles: readonly Role[];
  readonly emailVerified: boolean;
  /** True when this session passed a second factor. Staff permissions require it. */
  readonly mfa: boolean;
  /** Terms version accepted by this principal, or null if never accepted. */
  readonly termsVersion: string | null;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AccessTokenService {
  issue(principal: Principal): Promise<IssuedToken>;
  /** Returns null for invalid, expired or tampered tokens. */
  verify(token: string): Promise<Principal | null>;
}

export interface RefreshSession {
  readonly familyId: string;
  readonly subject: { readonly kind: Principal["kind"]; readonly id: EntityId };
  readonly deviceId: EntityId;
  readonly mfa: boolean;
}

export type RefreshRotation =
  | { readonly status: "rotated"; readonly session: RefreshSession; readonly refreshToken: IssuedToken }
  | { readonly status: "reused" }
  | { readonly status: "invalid" };

/**
 * Opaque refresh tokens stored hashed. Every refresh rotates the token; presenting an already-used
 * token means it was stolen, so the whole family is revoked (reuse detection).
 */
export interface RefreshTokenStore {
  issue(session: RefreshSession): Promise<IssuedToken>;
  rotate(token: string): Promise<RefreshRotation>;
  revokeByToken(token: string): Promise<void>;
  revokeAllForSubject(subjectId: EntityId): Promise<void>;
}

export type OneTimeTokenPurpose = "verify-email" | "reset-password";

/** Single-use, expiring tokens delivered by email. Stored hashed; consuming deletes them. */
export interface OneTimeTokenStore {
  create(purpose: OneTimeTokenPurpose, userId: EntityId, ttlMs: number): Promise<string>;
  consume(purpose: OneTimeTokenPurpose, token: string): Promise<EntityId | null>;
}

export interface TotpService {
  generateSecret(): string;
  buildUri(secret: string, accountName: string): string;
  verify(secret: string, code: string): boolean;
  generateRecoveryCodes(): string[];
}

/** Authenticated encryption for secrets that must be recoverable (TOTP secrets). */
export interface SecretCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
