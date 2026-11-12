import type { Collection, Db } from "mongodb";
import type {
  IssuedToken,
  OneTimeTokenPurpose,
  OneTimeTokenStore,
  RefreshRotation,
  RefreshSession,
  RefreshTokenStore,
} from "../../application/features/identity/ports.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";
import { randomToken, sha256 } from "./crypto.js";

const REFRESH_COLLECTION = "refresh_tokens";
const ONE_TIME_COLLECTION = "one_time_tokens";
/**
 * Two tabs refreshing at the same moment present the same token; within this window a second use is
 * a benign race (rejected, family kept). Later reuse means the token leaked and the family is revoked.
 */
const REUSE_GRACE_MS = 5000;

interface RefreshTokenDocument {
  _id: string;
  familyId: string;
  subjectKind: RefreshSession["subject"]["kind"];
  subjectId: string;
  deviceId: string;
  mfa: boolean;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

interface OneTimeTokenDocument {
  _id: string;
  purpose: OneTimeTokenPurpose;
  userId: string;
  expiresAt: Date;
}

/** TTL indexes let MongoDB delete expired tokens on its own. */
export const TOKEN_INDEXES: readonly MongoIndexDefinition[] = [
  {
    collection: REFRESH_COLLECTION,
    indexes: [
      { key: { expiresAt: 1 }, name: "expires_ttl", expireAfterSeconds: 0 },
      { key: { familyId: 1 }, name: "family" },
      { key: { subjectId: 1 }, name: "subject" },
    ],
  },
  {
    collection: ONE_TIME_COLLECTION,
    indexes: [{ key: { expiresAt: 1 }, name: "expires_ttl", expireAfterSeconds: 0 }],
  },
];

/** Only SHA-256 hashes of refresh tokens are stored; the raw token lives in the httpOnly cookie. */
export class MongoRefreshTokenStore implements RefreshTokenStore {
  readonly #tokens: Collection<RefreshTokenDocument>;

  constructor(
    database: Db,
    private readonly ttlMs: number,
  ) {
    this.#tokens = database.collection<RefreshTokenDocument>(REFRESH_COLLECTION);
  }

  async issue(session: RefreshSession): Promise<IssuedToken> {
    const token = randomToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.#tokens.insertOne({
      _id: sha256(token),
      familyId: session.familyId,
      subjectKind: session.subject.kind,
      subjectId: session.subject.id,
      deviceId: session.deviceId,
      mfa: session.mfa,
      createdAt: now,
      expiresAt,
      usedAt: null,
    });
    return { token, expiresAt };
  }

  async rotate(token: string): Promise<RefreshRotation> {
    const now = new Date();
    const claimed = await this.#tokens.findOneAndUpdate(
      { _id: sha256(token), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
    );

    if (!claimed) {
      const previous = await this.#tokens.findOne({ _id: sha256(token) });
      if (previous?.usedAt && now.getTime() - previous.usedAt.getTime() > REUSE_GRACE_MS) {
        await this.#tokens.deleteMany({ familyId: previous.familyId });
        return { status: "reused" };
      }
      return { status: "invalid" };
    }

    const session: RefreshSession = {
      familyId: claimed.familyId,
      subject: { kind: claimed.subjectKind, id: claimed.subjectId },
      deviceId: claimed.deviceId,
      mfa: claimed.mfa,
    };
    return { status: "rotated", session, refreshToken: await this.issue(session) };
  }

  async revokeByToken(token: string): Promise<void> {
    const document = await this.#tokens.findOne({ _id: sha256(token) });
    if (document) await this.#tokens.deleteMany({ familyId: document.familyId });
  }

  async revokeAllForSubject(subjectId: string): Promise<void> {
    await this.#tokens.deleteMany({ subjectId });
  }
}

export class MongoOneTimeTokenStore implements OneTimeTokenStore {
  readonly #tokens: Collection<OneTimeTokenDocument>;

  constructor(database: Db) {
    this.#tokens = database.collection<OneTimeTokenDocument>(ONE_TIME_COLLECTION);
  }

  async create(purpose: OneTimeTokenPurpose, userId: string, ttlMs: number): Promise<string> {
    const token = randomToken();
    await this.#tokens.insertOne({
      _id: sha256(token),
      purpose,
      userId,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  async consume(purpose: OneTimeTokenPurpose, token: string): Promise<string | null> {
    const document = await this.#tokens.findOneAndDelete({
      _id: sha256(token),
      purpose,
      expiresAt: { $gt: new Date() },
    });
    return document?.userId ?? null;
  }
}
