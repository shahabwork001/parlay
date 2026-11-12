import { describe, expect, it } from "vitest";
import { GetDashboard } from "../../../src/application/features/admin/admin-queries.js";
import {
  DecideAppeal,
  IssueManualBan,
  LiftBan,
} from "../../../src/application/features/admin/ban-actions.js";
import {
  DecideReport,
  DEFAULT_WARNING,
  RecordEscalation,
} from "../../../src/application/features/admin/report-decisions.js";
import { SetStaffRoles, UpdateTextRules } from "../../../src/application/features/admin/staff-and-rules.js";
import { personalTargets } from "../../../src/application/features/moderation/network.js";
import { DEFAULT_TEXT_RULES } from "../../../src/domain/moderation/text-rules.js";
import { createAdminFakes, staffPrincipal } from "../../support/admin-fakes.js";

const moderator = staffPrincipal(["Moderator"]);
const support = staffPrincipal(["Support"]);
const superAdmin = staffPrincipal(["SuperAdmin"]);

describe("DecideReport", () => {
  it("bans the reported person, lowers their trust and audits the decision", async () => {
    const fakes = createAdminFakes();
    const report = await fakes.report("hate");

    const result = await new DecideReport(fakes.context).execute(moderator, report.id, {
      action: "ban",
      mode: "full",
      durationHours: 72,
      includeNetwork: true,
      message: "Slurs are not allowed.",
    });

    expect(result.ok && result.value.status).toBe("actioned");
    const [ban] = fakes.bans.all();
    expect(ban).toMatchObject({
      reason: "hate",
      source: "moderator",
      createdBy: moderator.subjectId,
      reportId: report.id,
    });
    expect(ban!.targets.map((target) => target.kind)).toEqual(["account", "device", "ip", "subnet"]);
    expect(ban!.expiresAt!.getTime() - fakes.clock().getTime()).toBe(72 * 60 * 60_000);
    expect(await fakes.trust.scoreOf(["user:reported"])).toBe(35);
    expect(fakes.audit.entries.at(-1)).toMatchObject({
      action: "report.decided",
      metadata: { outcome: "banned" },
    });
  });

  it("warns without banning and penalises the reporter when dismissed", async () => {
    const fakes = createAdminFakes();
    const warned = await fakes.report();
    const dismissed = await fakes.report("spam");
    const decide = new DecideReport(fakes.context);

    await decide.execute(moderator, warned.id, { action: "warn" });
    await decide.execute(moderator, dismissed.id, { action: "dismiss", note: "Banter between friends" });

    expect(fakes.notifier.warnings).toEqual([
      { targets: personalTargets(warned.reported), message: DEFAULT_WARNING },
    ]);
    expect(fakes.bans.all()).toHaveLength(0);
    expect(await fakes.trust.scoreOf(["device:reporter"])).toBe(45);
    expect((await fakes.reports.getById(dismissed.id))?.resolution).toMatchObject({
      outcome: "dismissed",
      note: "Banter between friends",
    });
  });

  it("decides a report only once", async () => {
    const fakes = createAdminFakes();
    const report = await fakes.report();
    const decide = new DecideReport(fakes.context);
    await decide.execute(moderator, report.id, { action: "dismiss" });

    const again = await decide.execute(moderator, report.id, { action: "warn" });
    expect(!again.ok && again.error.code).toBe("report.already_resolved");
  });

  it("lifts the automatic minor-safety suspension and restricts the decision to escalating staff", async () => {
    const fakes = createAdminFakes();
    const report = await fakes.report("appears-minor");
    await fakes.banService.issueAutomatic(
      personalTargets(report.reported),
      "pending-review",
      null,
      report.id,
    );

    const denied = await new DecideReport(fakes.context).execute(support, report.id, { action: "dismiss" });
    expect(!denied.ok && denied.error.code).toBe("report.escalation_restricted");

    const result = await new DecideReport(fakes.context).execute(moderator, report.id, {
      action: "ban",
      mode: "full",
      durationHours: null,
      includeNetwork: false,
    });
    expect(result.ok).toBe(true);
    const bans = fakes.bans.all();
    expect(bans.find((ban) => ban.reason === "pending-review")?.liftedAt).not.toBeNull();
    expect(bans.find((ban) => ban.reason === "underage")).toMatchObject({ expiresAt: null, liftedAt: null });
  });

  it("marks a dismissed minor-safety report as not requiring escalation", async () => {
    const fakes = createAdminFakes();
    const report = await fakes.report("appears-minor");
    await new DecideReport(fakes.context).execute(moderator, report.id, { action: "dismiss" });
    expect((await fakes.reports.getById(report.id))?.escalation).toBe("not-required");
  });
});

describe("RecordEscalation", () => {
  it("needs a reference when reported, and applies to minor-safety reports only", async () => {
    const fakes = createAdminFakes();
    const minor = await fakes.report("child-sexual-content");
    const other = await fakes.report("spam");
    const escalate = new RecordEscalation(fakes.context);

    const missing = await escalate.execute(moderator, minor.id, { status: "reported" });
    expect(!missing.ok && missing.error.code).toBe("report.reference_required");
    const recorded = await escalate.execute(moderator, minor.id, {
      status: "reported",
      reference: " CT-123 ",
    });
    expect(recorded.ok && [recorded.value.escalation, recorded.value.escalationReference]).toEqual([
      "reported",
      "CT-123",
    ]);
    const wrong = await escalate.execute(moderator, other.id, { status: "not-required" });
    expect(!wrong.ok && wrong.error.code).toBe("report.escalation_not_applicable");
    expect(fakes.audit.entries.map((entry) => entry.action)).toEqual(["report.escalated"]);
  });
});

describe("ban actions", () => {
  it("issues manual bans with hashed network targets", async () => {
    const fakes = createAdminFakes();
    const result = await new IssueManualBan(fakes.context).execute(moderator, {
      accountId: "user-1",
      deviceIds: ["device-1"],
      ip: "203.0.113.9",
      includeSubnet: true,
      mode: "shadow",
      reason: "spam",
      durationHours: 24,
    });

    expect(result.ok && result.value.targets).toEqual([
      { kind: "account", value: "user-1" },
      { kind: "device", value: "device-1" },
      { kind: "ip", value: "ip#203.0.113.9" },
      { kind: "subnet", value: "ip#203.0.113.0/24" },
    ]);
    const none = await new IssueManualBan(fakes.context).execute(moderator, {
      includeSubnet: false,
      mode: "full",
      reason: "spam",
      durationHours: null,
    });
    expect(!none.ok && none.error.code).toBe("ban.no_targets");
  });

  it("lifts bans and decides appeals once", async () => {
    const fakes = createAdminFakes();
    const ban = await fakes.banService.issue({
      targets: [{ kind: "device", value: "d" }],
      mode: "full",
      reason: "harassment",
      source: "moderator",
    });
    ban.submitAppeal("It was my brother using my laptop.", fakes.clock());
    await fakes.bans.update(ban);

    const accepted = await new DecideAppeal(fakes.context).execute(support, ban.id, true);
    expect(accepted.ok && accepted.value.appeal?.status).toBe("accepted");
    expect(
      await fakes.banService.checkAccess({
        kind: "anonymous",
        subjectId: "d",
        deviceId: "d",
        networkHash: "",
        subnetHash: "",
      }),
    ).toEqual({
      status: "allowed",
    });
    const again = await new DecideAppeal(fakes.context).execute(support, ban.id, false);
    expect(!again.ok && again.error.code).toBe("ban.no_pending_appeal");

    const lift = await new LiftBan(fakes.context).execute(moderator, ban.id);
    expect(!lift.ok && lift.error.code).toBe("ban.not_active");
    expect(fakes.audit.entries.map((entry) => entry.action)).toEqual(["appeal.accepted"]);
  });
});

describe("SetStaffRoles", () => {
  it("grants roles, signs the person out and audits the change", async () => {
    const fakes = createAdminFakes();
    const person = await fakes.user("mod@example.com");
    await fakes.identity.refreshTokens.issue({
      familyId: "f1",
      subject: { kind: "user", id: person.id },
      deviceId: "d",
      mfa: false,
    });

    const result = await new SetStaffRoles(fakes.context).execute(superAdmin, { email: "MOD@example.com" }, [
      "Moderator",
    ]);

    expect(result.ok && result.value.roles).toEqual(["Moderator"]);
    expect(fakes.identity.refreshTokens.tokens.size).toBe(0);
    expect(fakes.audit.entries.at(-1)).toMatchObject({
      action: "staff.roles_changed",
      metadata: { from: null, to: "Moderator" },
    });
  });

  it("protects the last SuperAdmin and the actor's own roles", async () => {
    const fakes = createAdminFakes();
    const only = await fakes.user("root@example.com", ["SuperAdmin"]);
    const actor = staffPrincipal(["SuperAdmin"], { subjectId: "someone-else" });

    const demote = await new SetStaffRoles(fakes.context).execute(actor, { userId: only.id }, ["Admin"]);
    expect(!demote.ok && demote.error.code).toBe("staff.last_super_admin");
    const self = await new SetStaffRoles(fakes.context).execute(
      staffPrincipal(["SuperAdmin"], { subjectId: only.id }),
      { userId: only.id },
      [],
    );
    expect(!self.ok && self.error.code).toBe("staff.self");
    const missing = await new SetStaffRoles(fakes.context).execute(
      actor,
      { email: "nobody@example.com" },
      [],
    );
    expect(!missing.ok && missing.error.code).toBe("user.not_found");
  });
});

describe("UpdateTextRules", () => {
  it("normalises word lists and audits the change", async () => {
    const fakes = createAdminFakes();
    const saved = await new UpdateTextRules(fakes.context).execute(staffPrincipal(["Admin"]), {
      ...DEFAULT_TEXT_RULES,
      maskedWords: [" Darn ", "darn", "heck"],
      blockedWords: ["SLURX"],
    });

    expect(saved.maskedWords).toEqual(["darn", "heck"]);
    expect(fakes.textRules.rules.blockedWords).toEqual(["slurx"]);
    expect(fakes.audit.entries.at(-1)).toMatchObject({
      action: "rules.updated",
      metadata: { maskedWords: "16 -> 2", added: "darn,heck,slurx" },
    });
  });
});

describe("GetDashboard", () => {
  it("combines live and stored numbers", async () => {
    const fakes = createAdminFakes();
    const dashboard = await new GetDashboard(fakes.context).execute();
    expect(dashboard).toMatchObject({
      online: 12,
      waiting: { text: 2, video: 1 },
      activeSessions: 4,
      averageWaitMs: 1500,
      openReports: { critical: 1, normal: 2 },
      pendingAppeals: 3,
    });
    expect(dashboard.matchesPerMinute).toHaveLength(60);
    expect(dashboard.reportsPerHour).toHaveLength(24);
  });
});
