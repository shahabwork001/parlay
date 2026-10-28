import { type Collection, type Db, MongoServerError } from "mongodb";
import { v7 as uuidv7 } from "uuid";
import type { AuditEntry, AuditLog } from "../../application/features/moderation/ports.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";

const COLLECTION = "audit_log";
const DUPLICATE_KEY = 11000;

type AuditDocument = Omit<AuditEntry, "id"> & { _id: string };

export const AUDIT_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { at: -1 }, name: "recent" },
    { key: { "target.type": 1, "target.id": 1, at: -1 }, name: "target" },
    { key: { "actor.subjectId": 1, at: -1 }, name: "actor" },
  ],
};

/** Insert-only. Entries with an id (derived from an event) are written at most once. */
export class MongoAuditLog implements AuditLog {
  readonly #entries: Collection<AuditDocument>;

  constructor(database: Db) {
    this.#entries = database.collection<AuditDocument>(COLLECTION);
  }

  async record(entry: AuditEntry): Promise<void> {
    const { id, ...rest } = entry;
    try {
      await this.#entries.insertOne({ ...rest, _id: id ?? uuidv7() });
    } catch (error) {
      if (id && error instanceof MongoServerError && error.code === DUPLICATE_KEY) return;
      throw error;
    }
  }
}
