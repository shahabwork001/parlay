import { AggregateRoot } from "../common/aggregate-root.js";
import { AppErrors } from "../common/app-error.js";
import { type EntityId, newEntityId } from "../common/entity.js";
import { fail, okVoid, type Result } from "../common/result.js";
import { isStaff, type Role } from "./roles.js";
import type { TermsAcceptance } from "./terms-acceptance.js";

export interface LockoutPolicy {
  readonly maxFailedAttempts: number;
  readonly lockoutMs: number;
}

export interface TwoFactorState {
  /** TOTP secret, encrypted at rest by infrastructure. */
  readonly encryptedSecret: string;
  readonly enabledAt: Date | null;
  readonly recoveryCodeHashes: readonly string[];
}

export interface UserState {
  readonly id: EntityId;
  readonly version: number;
  readonly email: string;
  readonly passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  readonly roles: readonly Role[];
  readonly termsAcceptance: TermsAcceptance | null;
  readonly twoFactor: TwoFactorState | null;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
  readonly createdAt: Date;
}

/** Normalises an email for storage and lookup. Format validation happens at the boundary. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class User extends AggregateRoot {
  readonly email: string;
  readonly createdAt: Date;
  #passwordHash: string;
  #emailVerifiedAt: Date | null;
  #roles: readonly Role[];
  #termsAcceptance: TermsAcceptance | null;
  #twoFactor: TwoFactorState | null;
  #failedLoginCount: number;
  #lockedUntil: Date | null;

  private constructor(state: UserState) {
    super(state.id, state.version);
    this.email = state.email;
    this.createdAt = state.createdAt;
    this.#passwordHash = state.passwordHash;
    this.#emailVerifiedAt = state.emailVerifiedAt;
    this.#roles = state.roles;
    this.#termsAcceptance = state.termsAcceptance;
    this.#twoFactor = state.twoFactor;
    this.#failedLoginCount = state.failedLoginCount;
    this.#lockedUntil = state.lockedUntil;
  }

  static register(email: string, passwordHash: string, acceptance: TermsAcceptance, now: Date): User {
    return new User({
      id: newEntityId(),
      version: 0,
      email: normalizeEmail(email),
      passwordHash,
      emailVerifiedAt: null,
      roles: [],
      termsAcceptance: acceptance,
      twoFactor: null,
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: now,
    });
  }

  /** Staff accounts are created verified (seed or invitation); they must still enrol 2FA. */
  static createStaff(email: string, passwordHash: string, roles: readonly Role[], now: Date): User {
    return new User({
      id: newEntityId(),
      version: 0,
      email: normalizeEmail(email),
      passwordHash,
      emailVerifiedAt: now,
      roles,
      termsAcceptance: null,
      twoFactor: null,
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: now,
    });
  }

  static restore(state: UserState): User {
    return new User(state);
  }

  get passwordHash(): string {
    return this.#passwordHash;
  }

  get emailVerifiedAt(): Date | null {
    return this.#emailVerifiedAt;
  }

  get isEmailVerified(): boolean {
    return this.#emailVerifiedAt !== null;
  }

  get roles(): readonly Role[] {
    return this.#roles;
  }

  get isStaff(): boolean {
    return isStaff(this.#roles);
  }

  get termsAcceptance(): TermsAcceptance | null {
    return this.#termsAcceptance;
  }

  get twoFactor(): TwoFactorState | null {
    return this.#twoFactor;
  }

  get isTwoFactorEnabled(): boolean {
    return this.#twoFactor?.enabledAt != null;
  }

  get failedLoginCount(): number {
    return this.#failedLoginCount;
  }

  get lockedUntil(): Date | null {
    return this.#lockedUntil;
  }

  isLocked(now: Date): boolean {
    return this.#lockedUntil !== null && this.#lockedUntil > now;
  }

  verifyEmail(now: Date): void {
    this.#emailVerifiedAt ??= now;
  }

  recordFailedLogin(now: Date, policy: LockoutPolicy): void {
    this.#failedLoginCount += 1;
    if (this.#failedLoginCount >= policy.maxFailedAttempts) {
      this.#lockedUntil = new Date(now.getTime() + policy.lockoutMs);
      this.#failedLoginCount = 0;
    }
  }

  recordSuccessfulLogin(): void {
    this.#failedLoginCount = 0;
    this.#lockedUntil = null;
  }

  changePassword(passwordHash: string): void {
    this.#passwordHash = passwordHash;
    this.#failedLoginCount = 0;
    this.#lockedUntil = null;
  }

  recordAcceptance(acceptance: TermsAcceptance): void {
    this.#termsAcceptance = acceptance;
  }

  startTwoFactorEnrollment(encryptedSecret: string): Result<undefined> {
    if (this.isTwoFactorEnabled) {
      return fail(
        AppErrors.conflict("two_factor.already_enabled", "Two-factor authentication is already enabled."),
      );
    }
    this.#twoFactor = { encryptedSecret, enabledAt: null, recoveryCodeHashes: [] };
    return okVoid();
  }

  enableTwoFactor(recoveryCodeHashes: readonly string[], now: Date): Result<undefined> {
    if (!this.#twoFactor) {
      return fail(AppErrors.validation("two_factor.not_started", "Start two-factor setup first."));
    }
    if (this.isTwoFactorEnabled) {
      return fail(
        AppErrors.conflict("two_factor.already_enabled", "Two-factor authentication is already enabled."),
      );
    }
    this.#twoFactor = { ...this.#twoFactor, enabledAt: now, recoveryCodeHashes };
    return okVoid();
  }

  /** Consumes a recovery code (single use). Returns false when the hash is not one of ours. */
  useRecoveryCode(codeHash: string): boolean {
    const twoFactor = this.#twoFactor;
    if (!twoFactor?.recoveryCodeHashes.includes(codeHash)) return false;
    this.#twoFactor = {
      ...twoFactor,
      recoveryCodeHashes: twoFactor.recoveryCodeHashes.filter((hash) => hash !== codeHash),
    };
    return true;
  }
}
