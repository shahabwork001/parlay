import { Binary, type Collection, type Db } from "mongodb";
import type {
  Evidence,
  EvidenceMessage,
  EvidenceStore,
} from "../../application/features/moderation/ports.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";

const COLLECTION = "evidence";

interface EvidenceDocument {
  _id: string;
  reportId: string;
  snapshot: { contentType: "image/jpeg"; data: Binary } | null;
  messages: EvidenceMessage[];
  createdAt: Date;
  expiresAt: Date;
}

/** MongoDB deletes evidence by itself once `expiresAt` passes (TTL index), enforcing the retention policy. */
export const EVIDENCE_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { expiresAt: 1 }, name: "retention_ttl", expireAfterSeconds: 0 },
    { key: { reportId: 1 }, name: "report" },
  ],
};

export class MongoEvidenceStore implements EvidenceStore {
  readonly #evidence: Collection<EvidenceDocument>;

  constructor(database: Db) {
    this.#evidence = database.collection<EvidenceDocument>(COLLECTION);
  }

  async save(evidence: Evidence): Promise<void> {
    await this.#evidence.insertOne({
      _id: evidence.id,
      reportId: evidence.reportId,
      snapshot: evidence.snapshot
        ? { contentType: evidence.snapshot.contentType, data: new Binary(evidence.snapshot.data) }
        : null,
      messages: [...evidence.messages],
      createdAt: evidence.createdAt,
      expiresAt: evidence.expiresAt,
    });
  }

  async get(id: string): Promise<Evidence | null> {
    const document = await this.#evidence.findOne({ _id: id });
    // The TTL monitor runs about once a minute, so expired documents can linger briefly.
    if (!document || document.expiresAt <= new Date()) return null;
    return {
      id: document._id,
      reportId: document.reportId,
      snapshot: document.snapshot
        ? { contentType: document.snapshot.contentType, data: Buffer.from(document.snapshot.data.buffer) }
        : null,
      messages: document.messages,
      createdAt: document.createdAt,
      expiresAt: document.expiresAt,
    };
  }
}
