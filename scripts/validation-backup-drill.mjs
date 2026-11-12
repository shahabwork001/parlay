// Executed through stdin in an isolated API image, never against the user's running stack.
import { createHash } from "node:crypto";
import { MongoClient, BSON } from "mongodb";
import {
  Argon2PasswordHasher,
  AesGcmSecretCipher,
} from "./dist/infrastructure/identity/crypto.js";

const run = process.env.PARLEY_VALIDATION_RUN;
if (
  !/^[a-f0-9]{12}$/.test(run ?? "") ||
  process.env.MONGO_DATABASE !== "parley_validation"
)
  throw new Error("Refusing a non-validation database");
const mode = process.env.VALIDATION_DRILL_ACTION;
const client = new MongoClient(process.env.MONGO_URI);
const critical = [
  "users",
  "devices",
  "reports",
  "evidence",
  "bans",
  "blocks",
  "trust_scores",
  "audit_log",
  "site_config",
  "plans",
  "premium_waitlist",
];
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const digest = (value) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        canonical(BSON.EJSON.serialize(value, { relaxed: false })),
      ),
    )
    .digest("hex");
async function snapshot(db) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (item) => item.name,
    ),
  );
  const rows = {};
  for (const name of critical.filter((item) => existing.has(item))) {
    const records = await db.collection(name).find().sort({ _id: 1 }).toArray();
    const indexes = (await db.collection(name).listIndexes().toArray()).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    rows[name] = {
      count: records.length,
      contentDigest: digest(records),
      indexDigest: digest(indexes),
    };
  }
  return rows;
}
try {
  await client.connect();
  const source = client.db("parley_validation");
  const restore = client.db(`parley_validation_restore_${run}`);
  if (mode === "prepare") {
    if ((await restore.listCollections().toArray()).length)
      throw new Error(
        "Restore database already exists; refusing to overwrite it",
      );
    const manifest = await snapshot(source);
    if (
      !manifest.users?.count ||
      !manifest.reports?.count ||
      !manifest.bans?.count
    )
      throw new Error(
        "Run browser workflows first; empty data is not a meaningful restore drill",
      );
    await source
      .collection("validation_backup_manifest")
      .insertOne({ _id: run, manifest, createdAt: new Date() });
    process.stdout.write(
      JSON.stringify({
        prepared: true,
        collections: Object.keys(manifest).length,
      }) + "\n",
    );
  } else if (mode === "verify") {
    const expected = await source
      .collection("validation_backup_manifest")
      .findOne({ _id: run });
    if (!expected)
      throw new Error("No backup manifest for this validation run");
    const actual = await snapshot(restore);
    if (digest(actual) !== digest(expected.manifest))
      throw new Error(
        "Restored content/index digests differ from the consistent source snapshot",
      );
    const users = await restore
      .collection("users")
      .find({ emailVerifiedAt: { $ne: null }, roles: { $size: 0 } })
      .toArray();
    const hasher = new Argon2PasswordHasher();
    let passwordVerified = false;
    for (const user of users)
      if (
        await hasher.verify(user.passwordHash, "correct horse battery staple")
      ) {
        passwordVerified = true;
        break;
      }
    if (!passwordVerified)
      throw new Error("No restored browser-fixture password verifies");
    const staff = await restore.collection("users").findOne({
      "twoFactor.enabledAt": { $ne: null },
      "twoFactor.encryptedSecret": { $exists: true },
    });
    if (
      !staff ||
      !new AesGcmSecretCipher(process.env.TOTP_ENCRYPTION_KEY).decrypt(
        staff.twoFactor.encryptedSecret,
      )
    )
      throw new Error(
        "Restored staff TOTP encryption does not decrypt with the test key",
      );
    process.stdout.write(
      JSON.stringify({
        restored: true,
        collectionDigestsMatch: true,
        indexDigestsMatch: true,
        passwordVerified: true,
        staffEncryptionVerified: true,
        counts: Object.fromEntries(
          Object.entries(actual).map(([name, row]) => [name, row.count]),
        ),
      }) + "\n",
    );
  } else throw new Error("Unknown drill action");
} finally {
  await client.close();
}
