import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { KeyedHasher, PasswordHasher, SecretCipher } from "../../application/features/identity/ports.js";

/** Argon2id with the library defaults (19 MiB, 2 passes), the OWASP-recommended baseline. */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}

/** HMAC-SHA256 with a server-side pepper and a purpose prefix (domain separation). */
export class HmacKeyedHasher implements KeyedHasher {
  constructor(private readonly secret: string) {}

  hash(purpose: string, value: string): string {
    return createHmac("sha256", this.secret).update(`${purpose}:${value}`).digest("base64url");
  }
}

/** Unkeyed hash for high-entropy random tokens (refresh and email tokens) before storage. */
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("base64url");

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** AES-256-GCM. Output format: base64url(iv | tag | ciphertext). */
export class AesGcmSecretCipher implements SecretCipher {
  readonly #key: Buffer;

  constructor(base64Key: string) {
    this.#key = Buffer.from(base64Key, "base64");
    if (this.#key.length !== 32) throw new Error("The secret encryption key must be 32 bytes (base64).");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }

  decrypt(encoded: string): string {
    const data = Buffer.from(encoded, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.#key, data.subarray(0, IV_BYTES));
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString(
      "utf8",
    );
  }
}
