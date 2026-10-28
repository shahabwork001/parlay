import { describe, expect, it } from "vitest";
import { Ban } from "../../../src/domain/moderation/ban.js";
import { Report, reportPriority } from "../../../src/domain/moderation/report.js";
import { clampTrust, trustKeys, trustTier } from "../../../src/domain/moderation/trust.js";

const now = new Date("2026-10-26T12:00:00Z");
const HOUR = 60 * 60_000;

const party = (subjectId: string) => ({
  subjectId,
  deviceId: subjectId,
  kind: "anonymous" as const,
  networkHash: "n",
  subnetHash: "s",
});

describe("reportPriority", () => {
  const base = { classifierScore: null, reporterTrust: 50, reportedTrust: 50, recentReportsAgainst: 0 };

  it("always puts minor-safety reports at the top", () => {
    expect(reportPriority({ ...base, category: "appears-minor", reporterTrust: 0 })).toEqual({
      priority: 100,
      tier: "critical",
    });
    expect(reportPriority({ ...base, category: "child-sexual-content" }).tier).toBe("critical");
  });

  it("raises priority for classifier evidence, low trust and repeated reports", () => {
    const plain = reportPriority({ ...base, category: "harassment" }).priority;
    expect(reportPriority({ ...base, category: "harassment", classifierScore: 1 }).priority).toBe(plain + 20);
    expect(reportPriority({ ...base, category: "harassment", reportedTrust: 0 }).priority).toBe(plain + 10);
    expect(reportPriority({ ...base, category: "harassment", recentReportsAgainst: 9 }).priority).toBe(
      plain + 20,
    );
  });

  it("discounts reports from low-trust reporters and keeps non-minor reports below 100", () => {
    expect(reportPriority({ ...base, category: "spam", reporterTrust: 10 }).priority).toBe(20);
    const worst = reportPriority({
      ...base,
      category: "nudity",
      classifierScore: 1,
      reportedTrust: 0,
      recentReportsAgainst: 5,
    });
    expect(worst).toEqual({ priority: 99, tier: "critical" });
  });

  it("maps priorities to tiers", () => {
    expect(reportPriority({ ...base, category: "nudity" }).tier).toBe("high");
    expect(reportPriority({ ...base, category: "scam" }).tier).toBe("normal");
    expect(reportPriority({ ...base, category: "other" }).tier).toBe("low");
  });
});

describe("Report", () => {
  it("requires escalation for minor-safety categories only", () => {
    const report = (category: "appears-minor" | "spam") =>
      Report.submit(
        {
          sessionId: "s",
          mode: "video",
          category,
          note: null,
          reporter: party("a"),
          reported: party("b"),
          evidenceId: null,
        },
        now,
      );
    expect(report("appears-minor")).toMatchObject({
      escalation: "required",
      tier: "critical",
      isMinorSafety: true,
    });
    expect(report("spam")).toMatchObject({ escalation: null, status: "pending-review", scoredAt: null });
  });

  it("refines priority when scored", () => {
    const report = Report.submit(
      {
        sessionId: "s",
        mode: "video",
        category: "nudity",
        note: null,
        reporter: party("a"),
        reported: party("b"),
        evidenceId: null,
      },
      now,
    );
    report.applyScore(
      { image: 0.9, text: null, labels: ["skin-exposure"] },
      { reporterTrust: 50, reportedTrust: 20, recentReportsAgainst: 2 },
      now,
    );
    expect(report.priority).toBe(60 + 18 + 6 + 8);
    expect(report.scoredAt).toEqual(now);
  });
});

describe("Ban", () => {
  const issue = (durationMs: number | null, mode: "full" | "shadow" = "full") =>
    Ban.issue(
      {
        targets: [
          { kind: "device", value: "d" },
          { kind: "device", value: "d" },
        ],
        mode,
        reason: "spam",
        source: "moderator",
        durationMs,
      },
      now,
    );

  it("de-duplicates targets and computes expiry", () => {
    const ban = issue(HOUR);
    expect(ban.targets).toHaveLength(1);
    expect(ban.expiresAt).toEqual(new Date(now.getTime() + HOUR));
    expect(ban.isActive(new Date(now.getTime() + HOUR - 1))).toBe(true);
    expect(ban.isActive(new Date(now.getTime() + HOUR))).toBe(false);
    expect(issue(null).isPermanent).toBe(true);
  });

  it("accepts one appeal while active, and none for shadow bans", () => {
    const ban = issue(null);
    expect(ban.submitAppeal("I was misunderstood, please review this.", now)).toBeNull();
    expect(ban.submitAppeal("again", now)).toBe("ban.appeal_exists");
    expect(ban.appeal).toMatchObject({ status: "pending" });
    expect(issue(null, "shadow").submitAppeal("x".repeat(30), now)).toBe("ban.not_appealable");
  });

  it("can be lifted once", () => {
    const ban = issue(null);
    expect(ban.lift("moderator-1", now)).toBeNull();
    expect(ban.isActive(now)).toBe(false);
    expect(ban.lift("moderator-1", now)).toBe("ban.not_active");
  });

  it("refuses bans without targets", () => {
    expect(() =>
      Ban.issue({ targets: [], mode: "full", reason: "spam", source: "automatic" }, now),
    ).toThrow();
  });
});

describe("trust", () => {
  it("clamps, tiers and keys scores", () => {
    expect(clampTrust(130)).toBe(100);
    expect(clampTrust(-4)).toBe(0);
    expect(trustTier(24)).toBe("low");
    expect(trustTier(25)).toBe("standard");
    expect(trustKeys({ kind: "user", subjectId: "u", deviceId: "d" })).toEqual(["user:u", "device:d"]);
    expect(trustKeys({ kind: "anonymous", subjectId: "d", deviceId: "d" })).toEqual(["device:d"]);
  });
});
