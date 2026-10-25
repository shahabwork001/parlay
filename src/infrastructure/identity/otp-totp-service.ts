import { randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { TotpService } from "../../application/features/identity/ports.js";

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) compatible with every common authenticator app. */
export class OtpTotpService implements TotpService {
  constructor(private readonly issuer: string) {}

  generateSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  buildUri(secret: string, accountName: string): string {
    return this.totp(secret, accountName).toString();
  }

  /** Accepts the previous, current and next 30-second step to tolerate clock drift. */
  verify(secret: string, code: string): boolean {
    return this.totp(secret).validate({ token: code, window: 1 }) !== null;
  }

  generateRecoveryCodes(): string[] {
    const segment = () =>
      Array.from({ length: 5 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => `${segment()}-${segment()}`);
  }

  private totp(secret: string, label = "account"): TOTP {
    return new TOTP({
      issuer: this.issuer,
      label,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
  }
}
