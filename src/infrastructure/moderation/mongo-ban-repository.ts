import type { Db, Filter } from "mongodb";
import type { BanRepository } from "../../application/features/moderation/ports.js";
import { Ban, type BanState, type BanTarget, targetKey } from "../../domain/moderation/ban.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";
import { type AggregateDocument, MongoRepository } from "../persistence/mongo/mongo-repository.js";

const COLLECTION = "bans";

type BanDocument = AggregateDocument &
  Omit<BanState, "id" | "version"> & {
    /** `kind:value` for each target, so one multikey index answers "is any of these banned?". */
    targetKeys: string[];
  };

export const BAN_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { targetKeys: 1, liftedAt: 1 }, name: "targets_active" },
    { key: { createdAt: -1 }, name: "recent" },
    { key: { "appeal.status": 1, "appeal.submittedAt": 1 }, name: "appeals", sparse: true },
  ],
};

const activeFilter = (now: Date): Filter<BanDocument> => ({
  liftedAt: null,
  $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

export class MongoBanRepository extends MongoRepository<Ban, BanDocument> implements BanRepository {
  constructor(database: Db) {
    super(database, COLLECTION);
  }

  async findActive(targets: readonly BanTarget[], now: Date): Promise<Ban[]> {
    if (targets.length === 0) return [];
    const documents = await this.collection
      .find({ ...activeFilter(now), targetKeys: { $in: targets.map(targetKey) } })
      .toArray();
    return documents.map((document) => this.toAggregate(document));
  }

  async listActive(now: Date): Promise<Ban[]> {
    const documents = await this.collection.find(activeFilter(now)).toArray();
    return documents.map((document) => this.toAggregate(document));
  }

  protected toDocument(ban: Ban): BanDocument {
    return {
      _id: ban.id,
      version: ban.version,
      targets: ban.targets,
      targetKeys: ban.targets.map(targetKey),
      mode: ban.mode,
      reason: ban.reason,
      message: ban.message,
      source: ban.source,
      createdBy: ban.createdBy,
      reportId: ban.reportId,
      createdAt: ban.createdAt,
      expiresAt: ban.expiresAt,
      liftedAt: ban.liftedAt,
      liftedBy: ban.liftedBy,
      appeal: ban.appeal,
    };
  }

  protected toAggregate(document: BanDocument): Ban {
    const { _id, targetKeys: _targetKeys, ...state } = document;
    return Ban.restore({ ...state, id: _id });
  }
}
