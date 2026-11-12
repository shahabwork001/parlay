/**
 * Idempotent seed: creates the first SuperAdmin if none exists (the generated password is printed
 * exactly once, and only when SEED_PRINT_CREDENTIALS=true in local development; the account must
 * enrol two-factor authentication before staff permissions apply), and stores the default text
 * moderation rules and site configuration unless they exist. There are no plans to seed: Parley
 * launches free (ADR 0015).
 */
import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
import { User } from "../domain/identity/user.js";
import { loadSeedConfig } from "../infrastructure/config/config.js";
import { Argon2PasswordHasher } from "../infrastructure/identity/crypto.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { applyMongoIndexes } from "../infrastructure/persistence/mongo/mongo-indexes.js";
import { MongoUserRepository, USER_INDEXES } from "../infrastructure/persistence/mongo/user-repository.js";
import { MongoTextRulesProvider } from "../infrastructure/moderation/text-rules-store.js";
import { MongoSiteConfig } from "../infrastructure/site/mongo-site-config.js";

const config = loadSeedConfig();
const logger = createLogger({ service: "parley-seed", level: "info", pretty: false });
const { adminEmail, printCredentials } = config;

const client = new MongoClient(config.mongo.uri, {
  appName: "parley-seed",
  serverSelectionTimeoutMS: 10_000,
});
try {
  const database = client.db(config.mongo.database);
  await applyMongoIndexes(database, [USER_INDEXES], logger);
  const users = new MongoUserRepository(database);

  const rules = await new MongoTextRulesProvider(database).current();
  logger.info(
    { blockedWords: rules.blockedWords.length, maskedWords: rules.maskedWords.length },
    "Text moderation rules ready",
  );
  if (await new MongoSiteConfig(database).ensureDefaults()) logger.info("Default site configuration stored");

  if ((await users.countWithRole("SuperAdmin")) > 0) {
    logger.info("A SuperAdmin already exists; nothing to seed");
  } else if (await users.findByEmail(adminEmail)) {
    logger.error(
      { email: adminEmail },
      "SEED_ADMIN_EMAIL belongs to a non-admin account; choose another email",
    );
    process.exitCode = 1;
  } else {
    const password = randomBytes(18).toString("base64url");
    const passwordHash = await new Argon2PasswordHasher().hash(password);
    await users.add(User.createStaff(adminEmail, passwordHash, ["SuperAdmin"], new Date()));
    logger.info(
      { email: adminEmail },
      "SuperAdmin created; enrol two-factor authentication at first sign-in",
    );

    if (printCredentials) {
      process.stdout.write(
        `\n  SuperAdmin credentials (shown once, development only)\n  Email:    ${adminEmail}\n  Password: ${password}\n\n`,
      );
    }
  }
} finally {
  await client.close();
}
