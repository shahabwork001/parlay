import type { Db, IndexDescription } from "mongodb";
import type { Logger } from "../../observability/logger.js";

/** Indexes (including TTL indexes via `expireAfterSeconds`) for one collection, applied on startup. */
export interface MongoIndexDefinition {
  readonly collection: string;
  readonly indexes: readonly IndexDescription[];
}

/** Idempotent: `createIndexes` is a no-op for indexes that already exist with the same spec. */
export async function applyMongoIndexes(
  database: Db,
  definitions: readonly MongoIndexDefinition[],
  logger: Logger,
): Promise<void> {
  for (const definition of definitions) {
    if (definition.indexes.length === 0) continue;
    await database.collection(definition.collection).createIndexes([...definition.indexes]);
    logger.info({ collection: definition.collection }, "Mongo indexes applied");
  }
}
