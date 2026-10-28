import type { Db } from "mongodb";
import type { ReportRepository } from "../../application/features/moderation/ports.js";
import { Report, type ReportState } from "../../domain/moderation/report.js";
import type { MongoIndexDefinition } from "../persistence/mongo/mongo-indexes.js";
import { type AggregateDocument, MongoRepository } from "../persistence/mongo/mongo-repository.js";

const COLLECTION = "reports";

type ReportDocument = AggregateDocument & Omit<ReportState, "id" | "version">;

export const REPORT_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [
    { key: { sessionId: 1, "reporter.subjectId": 1 }, name: "session_reporter_unique", unique: true },
    { key: { "reported.subjectId": 1, createdAt: -1 }, name: "reported_recent" },
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
      createdAt: report.createdAt,
      scoredAt: report.scoredAt,
      resolvedAt: report.resolvedAt,
    };
  }

  protected toAggregate(document: ReportDocument): Report {
    const { _id, ...state } = document;
    return Report.restore({ ...state, id: _id });
  }
}
