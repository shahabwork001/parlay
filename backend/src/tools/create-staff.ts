/**
 * Creates a staff account with two-factor authentication already enabled and prints its credentials
 * once, as JSON: { email, password, totpSecret, recoveryCodes }. For bootstrapping staff without the
 * UI, and for the end-to-end tests. Run inside the API container (it needs the API secrets):
 *
 *   docker compose exec api node dist/tools/create-staff.js --email mod@example.com --role Moderator
 *
 * Refuses to touch an existing account: promote existing accounts from the admin panel instead.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { MongoClient } from "mongodb";
import { isRole, type Role } from "../domain/identity/roles.js";
import { normalizeEmail, User } from "../domain/identity/user.js";
import { loadApiConfig } from "../infrastructure/config/config.js";
import {
  AesGcmSecretCipher,
  Argon2PasswordHasher,
  HmacKeyedHasher,
} from "../infrastructure/identity/crypto.js";
import { OtpTotpService } from "../infrastructure/identity/otp-totp-service.js";
import { MongoUserRepository } from "../infrastructure/persistence/mongo/user-repository.js";

const { values } = parseArgs({
  options: { email: { type: "string" }, role: { type: "string", multiple: true } },
});
const email = values.email ? normalizeEmail(values.email) : "";
const roles: Role[] = (values.role ?? []).filter(isRole);
if (!email.includes("@") || roles.length === 0 || roles.length !== (values.role ?? []).length) {
  process.stderr.write(
    "Usage: create-staff --email <email> --role <SuperAdmin|Admin|Moderator|Support> [--role ...]\n",
  );
  process.exit(2);
}

const config = loadApiConfig();
const client = new MongoClient(config.mongo.uri, {
  appName: "parley-create-staff",
  serverSelectionTimeoutMS: 10_000,
});
try {
  const users = new MongoUserRepository(client.db(config.mongo.database));
  if (await users.findByEmail(email)) {
    process.stderr.write(`An account with ${email} already exists.\n`);
    process.exitCode = 1;
  } else {
    const totp = new OtpTotpService("Parley");
    const hasher = new HmacKeyedHasher(config.auth.hashSecret);
    const password = randomBytes(18).toString("base64url");
    const secret = totp.generateSecret();
    const recoveryCodes = totp.generateRecoveryCodes();
    const now = new Date();

    const user = User.createStaff(email, await new Argon2PasswordHasher().hash(password), roles, now);
    user.startTwoFactorEnrollment(new AesGcmSecretCipher(config.auth.totpEncryptionKey).encrypt(secret));
    user.enableTwoFactor(
      recoveryCodes.map((code) => hasher.hash("recovery-code", code)),
      now,
    );
    await users.add(user);
    process.stdout.write(`${JSON.stringify({ email, password, totpSecret: secret, recoveryCodes })}\n`);
  }
} finally {
  await client.close();
}
