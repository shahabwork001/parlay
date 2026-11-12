import type { Redis } from "ioredis";
import type { Collection, Db } from "mongodb";
import type { TrustStore } from "../../application/features/moderation/ports.js";
import { TRUST } from "../../domain/moderation/trust.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";

const COLLECTION = "trust_scores";
const CACHE_TTL_SECONDS = 300;

interface TrustDocument {
  _id: string;
  score: number;
  updatedAt: Date;
}

export const TRUST_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [{ key: { score: 1 }, name: "score" }],
};

/** Scores live in MongoDB; matchmaking reads them through a short-lived Redis cache. */
export class CachedTrustStore implements TrustStore {
  readonly #scores: Collection<TrustDocument>;

  constructor(
    database: Db,
    private readonly redis: Redis,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.#scores = database.collection<TrustDocument>(COLLECTION);
  }

  async scoreOf(keys: readonly string[]): Promise<number> {
    if (keys.length === 0) return TRUST.default;
    const cached = await this.redis.mget(...keys.map(cacheKey));
    const scores: number[] = [];
    const missing: string[] = [];
    keys.forEach((key, index) => {
      const value = cached[index];
      if (value === null || value === undefined) missing.push(key);
      else scores.push(Number(value));
    });

    if (missing.length > 0) {
      const documents = await this.#scores.find({ _id: { $in: missing } }).toArray();
      const byKey = new Map(documents.map((document) => [document._id, document.score]));
      const pipeline = this.redis.pipeline();
      for (const key of missing) {
        const score = byKey.get(key) ?? TRUST.default;
        scores.push(score);
        pipeline.set(cacheKey(key), String(score), "EX", CACHE_TTL_SECONDS);
      }
      await pipeline.exec();
    }
    return Math.min(...scores);
  }

  async adjust(keys: readonly string[], delta: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      // Clamp inside the update so concurrent adjustments never push a score out of range.
      const updated = await this.#scores.findOneAndUpdate(
        { _id: key },
        [
          {
            $set: {
              score: {
                $min: [
                  TRUST.max,
                  { $max: [TRUST.min, { $add: [{ $ifNull: ["$score", TRUST.default] }, delta] }] },
                ],
              },
              updatedAt: this.now(),
            },
          },
        ],
        { upsert: true, returnDocument: "after" },
      );
      if (updated) pipeline.set(cacheKey(key), String(updated.score), "EX", CACHE_TTL_SECONDS);
    }
    await pipeline.exec();
  }
}

const cacheKey = (key: string) => `trust:${key}`;
