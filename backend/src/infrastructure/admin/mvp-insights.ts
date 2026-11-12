import type { Db } from "mongodb";
import type { ProductMetrics } from "../../application/features/chat/product-metrics.js";
import type { KeyedHasher } from "../../application/features/identity/ports.js";

const DAY = 86_400_000;
export class MvpInsights implements ProductMetrics {
  constructor(
    private readonly db: Db,
    private readonly hasher: KeyedHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}
  private visitor(id: string) {
    return this.hasher.hash("device", `product:${id}`);
  }
  private day() {
    return this.now().toISOString().slice(0, 10);
  }
  private expires(days: number) {
    return new Date(this.now().getTime() + days * DAY);
  }
  async initialize(): Promise<void> {
    for (const collection of [
      "product_visitors",
      "daily_visitors",
      "daily_metrics",
      "product_sessions",
      "rtc_outcomes",
      "premium_waitlist",
      "premium_previews",
    ]) {
      await this.db
        .collection(collection)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "retention_ttl" });
    }
    await this.db.collection("daily_visitors").createIndex({ day: 1, returning: 1 });
    await this.db.collection("product_sessions").createIndex({ day: 1 });
    await this.db.collection("rtc_outcomes").createIndex({ day: 1 });
  }
  async activity(subjectId: string): Promise<void> {
    const visitor = this.visitor(subjectId),
      day = this.day();
    const previous = await this.db
      .collection<{ _id: string; firstDay: string; expiresAt: Date }>("product_visitors")
      .findOneAndUpdate(
        { _id: visitor },
        { $set: { expiresAt: this.expires(90) }, $setOnInsert: { firstDay: day } },
        { upsert: true, returnDocument: "before" },
      );
    await this.db.collection<{ _id: string }>("daily_visitors").updateOne(
      { _id: `${day}:${visitor}` },
      {
        $setOnInsert: {
          day,
          returning: !!previous && previous.expiresAt > this.now() && previous.firstDay < day,
          expiresAt: this.expires(35),
        },
      },
      { upsert: true },
    );
  }
  private async count(values: Record<string, number>): Promise<void> {
    await this.db
      .collection<{ _id: string }>("daily_metrics")
      .updateOne(
        { _id: this.day() },
        { $inc: values, $set: { expiresAt: this.expires(35) } },
        { upsert: true },
      );
  }
  async attempt(): Promise<void> {
    await this.count({ attempts: 1 });
  }
  async matched(waitMs: number): Promise<void> {
    const wait = Math.max(0, Math.min(86_400_000, Math.round(waitMs)));
    await this.db
      .collection<{ _id: string; waits: number[]; matches: number; waitTotal: number; expiresAt: Date }>(
        "daily_metrics",
      )
      .updateOne(
        { _id: this.day() },
        {
          $inc: { matches: 1, waitTotal: wait },
          $push: { waits: { $each: [wait], $slice: -2000 } },
          $set: { expiresAt: this.expires(35) },
        },
        { upsert: true },
      );
  }
  async sessionEnded(sessionId: string, startedAt: Date): Promise<void> {
    await this.db.collection<{ _id: string }>("product_sessions").updateOne(
      { _id: sessionId },
      {
        $setOnInsert: {
          day: this.day(),
          durationMs: Math.max(0, Math.min(this.now().getTime() - startedAt.getTime(), DAY)),
          expiresAt: this.expires(35),
        },
      },
      { upsert: true },
    );
  }
  async rtc(sessionId: string, subjectId: string, outcome: "connected" | "failed"): Promise<void> {
    await this.db
      .collection<{ _id: string }>("rtc_outcomes")
      .updateOne(
        { _id: `${sessionId}:${this.visitor(subjectId)}` },
        { $setOnInsert: { day: this.day(), outcome, expiresAt: this.expires(35) } },
        { upsert: true },
      );
  }
  async preview(userId: string): Promise<void> {
    await this.db
      .collection<{ _id: string }>("premium_previews")
      .updateOne(
        { _id: this.visitor(userId) },
        { $set: { expiresAt: this.expires(90) }, $setOnInsert: { firstSeenAt: this.now() } },
        { upsert: true },
      );
  }
  async joined(userId: string): Promise<boolean> {
    return (
      (await this.db
        .collection<{ _id: string }>("premium_waitlist")
        .countDocuments({ _id: userId, expiresAt: { $gt: this.now() } })) > 0
    );
  }
  async join(userId: string): Promise<void> {
    await this.preview(userId);
    // No duplicated email address, payment details, free text or fingerprint is stored in the list.
    await this.db.collection<{ _id: string }>("premium_waitlist").updateOne(
      { _id: userId },
      {
        $set: { consentVersion: "plus-interest-v1", expiresAt: this.expires(90) },
        $setOnInsert: { joinedAt: this.now(), planId: "parley-plus" },
      },
      { upsert: true },
    );
  }
  async leave(userId: string): Promise<void> {
    await this.db.collection<{ _id: string }>("premium_waitlist").deleteOne({ _id: userId });
  }
  async summary() {
    const day = this.day(),
      now = this.now();
    const [
      registeredUsers,
      activeToday,
      repeatVisitors,
      daily,
      sessions,
      rtc,
      waitlistSignups,
      premiumPreviewVisitors,
    ] = await Promise.all([
      this.db.collection("users").countDocuments(),
      this.db.collection("daily_visitors").countDocuments({ day }),
      this.db.collection("daily_visitors").countDocuments({ day, returning: true }),
      this.db
        .collection<{
          _id: string;
          attempts?: number;
          matches?: number;
          waitTotal?: number;
          waits?: number[];
        }>("daily_metrics")
        .findOne({ _id: day }),
      this.db
        .collection("product_sessions")
        .aggregate<{ mean: number; count: number }>([
          { $match: { day } },
          { $group: { _id: null, mean: { $avg: "$durationMs" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      this.db
        .collection("rtc_outcomes")
        .aggregate<{ _id: string; count: number }>([
          { $match: { day } },
          { $group: { _id: "$outcome", count: { $sum: 1 } } },
        ])
        .toArray(),
      this.db.collection("premium_waitlist").countDocuments({ expiresAt: { $gt: now } }),
      this.db.collection("premium_previews").countDocuments({ expiresAt: { $gt: now } }),
    ]);
    const waits = [...(daily?.waits ?? [])].sort((a, b) => a - b);
    const rtcCount = rtc.reduce((sum, row) => sum + row.count, 0),
      failed = rtc.find((row) => row._id === "failed")?.count ?? 0;
    return {
      day,
      registeredUsers,
      activeToday,
      repeatVisitors,
      matchAttempts: daily?.attempts ?? 0,
      successfulMatches: daily?.matches ?? 0,
      averageWaitMs: daily?.matches ? Math.round((daily.waitTotal ?? 0) / daily.matches) : null,
      sampledP95WaitMs: waits.length ? waits[Math.ceil(waits.length * 0.95) - 1] : null,
      averageSessionMs: sessions[0]?.mean ?? null,
      endedSessions: sessions[0]?.count ?? 0,
      rtcFailureRate: rtcCount ? failed / rtcCount : null,
      rtcReports: rtcCount,
      waitlistSignups,
      premiumPreviewVisitors,
      waitlistConversion: premiumPreviewVisitors ? waitlistSignups / premiumPreviewVisitors : null,
    };
  }
}
