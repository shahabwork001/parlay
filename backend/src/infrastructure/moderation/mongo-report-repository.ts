import type { Db } from "mongodb";
import type { ReportRepository } from "../../application/features/moderation/ports.js";
import { Report, type ReportResolution, type ReportState } from "../../domain/moderation/report.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";
import { type AggregateDocument, MongoRepository } from "../persistence/mongo/mongo-repository.js";

const COLLECTION = "reports";

type ReportDocument = AggregateDocument &
  Omit<ReportState, "id" | "version" | "escalationReference" | "resolution"> & {
    escalationReference?: string | null;
    resolution?: ReportResolution | null;
    workflowVersion?: number;
    scoringComplete?: boolean;
    lastScoringAttemptAt?: Date;
  };

export const REPORT_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { sessionId: 1, "reporter.subjectId": 1 }, name: "session_reporter_unique", unique: true },
    { key: { "reported.subjectId": 1, createdAt: -1 }, name: "reported_recent" },
    { key: { workflowVersion: 1, scoringComplete: 1, lastScoringAttemptAt: 1 }, name: "report_recovery" },
    // The review queue (Phase 6): open reports by priority, oldest first within a priority.
    { key: { status: 1, priority: -1, createdAt: 1 }, name: "queue" },
  ],
};

export class MongoReportRepository
  extends MongoRepository<Report, ReportDocument>
  implements ReportRepository
{
  constructor(database: Db) {
    super(database, COLLECTION);
  }

  override async add(report: Report): Promise<void> {
    report.version = 1;
    await this.collection.insertOne({
      ...this.toDocument(report),
      workflowVersion: 1,
      scoringComplete: false,
    });
  }
  override async update(report: Report): Promise<boolean> {
    const expected = report.version;
    report.version += 1;
    const { _id, ...fields } = this.toDocument(report);
    const updated = await this.collection.updateOne({ _id, version: expected }, { $set: fields });
    if (updated.matchedCount === 1) return true;
    report.version = expected;
    return false;
  }
  async isScoringComplete(id: string): Promise<boolean> {
    const doc = await this.collection.findOne({ _id: id });
    // Historical scored reports predate effect markers and must not be charged trust twice.
    return doc?.scoringComplete === true || (doc?.workflowVersion !== 1 && doc?.scoredAt != null);
  }
  async completeScoring(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { scoringComplete: true } });
  }
  async pendingScoring(): Promise<string[]> {
    const docs = await this.collection
      .find({ workflowVersion: 1, scoringComplete: false })
      .sort({ lastScoringAttemptAt: 1, createdAt: 1 })
      .limit(100)
      .toArray();
    if (docs.length)
      await this.collection.updateMany(
        { _id: { $in: docs.map((d) => d._id) } },
        { $set: { lastScoringAttemptAt: new Date() } },
      );
    return docs.map((d) => d._id);
  }

  async existsForSession(sessionId: string, reporterSubjectId: string): Promise<boolean> {
    return (
      (await this.collection.countDocuments(
        { sessionId, "reporter.subjectId": reporterSubjectId },
        { limit: 1 },
      )) > 0
    );
  }

  async countAgainst(
    subjectId: string,
    since: Date,
  ): Promise<{ reports: number; distinctReporters: number }> {
    const [result] = await this.collection
      .aggregate<{ reports: number; reporters: string[] }>([
        { $match: { "reported.subjectId": subjectId, createdAt: { $gte: since } } },
        { $group: { _id: null, reports: { $sum: 1 }, reporters: { $addToSet: "$reporter.deviceId" } } },
      ])
      .toArray();
    return { reports: result?.reports ?? 0, distinctReporters: result?.reporters.length ?? 0 };
  }

  protected toDocument(report: Report): ReportDocument {
    return {
      _id: report.id,
      version: report.version,
      sessionId: report.sessionId,
      mode: report.mode,
      category: report.category,
      note: report.note,
      reporter: report.reporter,
      reported: report.reported,
      evidenceId: report.evidenceId,
      status: report.status,
      priority: report.priority,
      tier: report.tier,
      score: report.score,
      escalation: report.escalation,
      escalationReference: report.escalationReference,
      resolution: report.resolution,
      createdAt: report.createdAt,
      scoredAt: report.scoredAt,
      resolvedAt: report.resolvedAt,
    };
  }

  protected toAggregate(document: ReportDocument): Report {
    const { _id, ...state } = document;
    // Reports stored before Phase 6 have no resolution fields.
    return Report.restore({
      ...state,
      escalationReference: state.escalationReference ?? null,
      resolution: state.resolution ?? null,
      id: _id,
    });
  }
}
