import type { Collection, Db } from "mongodb";
import type {
  AgeResult,
  AgeVerification,
  AgeVerificationProvider,
  AgeVerificationStore,
} from "../../application/features/identity/age-assurance.js";
export class MongoAgeVerificationStore implements AgeVerificationStore {
  private readonly records: Collection<AgeVerification & { _id: string }>;
  constructor(db: Db) {
    this.records = db.collection("age_verifications");
  }
  async initialize(): Promise<void> {
    await this.records.createIndex({ attemptId: 1 }, { unique: true });
  }
  async current(userId: string): Promise<AgeVerification | null> {
    return this.records.findOne({ _id: userId });
  }
  async pending(record: AgeVerification): Promise<void> {
    await this.records.replaceOne({ _id: record.userId }, record, { upsert: true });
  }
  async forAttempt(attemptId: string): Promise<AgeVerification | null> {
    return this.records.findOne({ attemptId });
  }
  async apply(userId: string, result: AgeResult, at: string): Promise<void> {
    await this.records.updateOne(
      { _id: userId, attemptId: result.attemptId, revision: { $lt: result.revision } },
      {
        $set: {
          status: result.status,
          expiresAt: result.expiresAt,
          revision: result.revision,
          updatedAt: at,
        },
      },
    );
  }
}
/** No self-attestation or mock age approval. Production stays closed until a real adapter is approved. */
export const unavailableAgeProvider: AgeVerificationProvider = {
  id: "none",
  available: false,
  start: () => Promise.reject(new Error("No approved age-verification provider is configured")),
  verifyWebhook: () => Promise.reject(new Error("Age verification is unavailable")),
};
