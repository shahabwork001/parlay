import type { Redis } from "ioredis";
import type { Collection, Db } from "mongodb";
import type { BlockRecord, BlockRepository } from "../../../application/features/chat/blocks.js";
import type { MongoIndexDefinition } from "./mongo-indexes.js";

const COLLECTION = "blocks";

interface BlockDocument extends BlockRecord {
  _id: string;
}

export const BLOCK_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { blockerSubjectId: 1 }, name: "blocker" },
    { key: { blockedSubjectId: 1 }, name: "blocked" },
  ],
};

/** Blocks are append-only facts keyed by the pair, so redelivered events are harmless. */
export class MongoBlockRepository implements BlockRepository {
  readonly #blocks: Collection<BlockDocument>;

  constructor(database: Db) {
    this.#blocks = database.collection<BlockDocument>(COLLECTION);
  }

  async restore(redis: Redis, prefix = "mm"): Promise<number> {
    let count = 0;
    for await (const block of this.#blocks.find()) {
      await redis.sadd(
        `${prefix}:blocks:${block.blockerSubjectId}`,
        block.blockedSubjectId,
        block.blockedDeviceId,
      );
      count += 1;
    }
    return count;
  }

  async record(block: BlockRecord): Promise<void> {
    const _id = `${block.blockerSubjectId}:${block.blockedSubjectId}`;
    await this.#blocks.updateOne({ _id }, { $setOnInsert: { _id, ...block } }, { upsert: true });
  }
}
