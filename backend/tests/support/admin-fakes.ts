import type { AdminContext } from "../../src/application/features/admin/admin-context.js";
import type {
  AdminReadModel,
  LiveStats,
  QueueInspector,
} from "../../src/application/features/admin/admin-read-model.js";
import { toPagedResult } from "../../src/application/common/paging.js";
import type { Principal } from "../../src/application/features/identity/ports.js";
import type {
  ModerationNotifier,
  TextRulesRepository,
} from "../../src/application/features/moderation/ports.js";
import type { Role } from "../../src/domain/identity/roles.js";
import { User } from "../../src/domain/identity/user.js";
import type { BanTarget } from "../../src/domain/moderation/ban.js";
import { Report, type ReportCategory } from "../../src/domain/moderation/report.js";
import { DEFAULT_TEXT_RULES, type TextRules } from "../../src/domain/moderation/text-rules.js";
import { createTestIdentity, fakeHasher } from "./identity-fakes.js";
import { createModerationFakes, participant } from "./moderation-fakes.js";

export class RecordingNotifier implements ModerationNotifier {
  readonly warnings: { targets: BanTarget[]; message: string }[] = [];

  warn(targets: readonly BanTarget[], message: string): Promise<void> {
    this.warnings.push({ targets: [...targets], message });
    return Promise.resolve();
  }
}

export class InMemoryTextRules implements TextRulesRepository {
  rules: TextRules = DEFAULT_TEXT_RULES;

  current(): Promise<TextRules> {
    return Promise.resolve(this.rules);
  }

  save(rules: TextRules): Promise<void> {
    this.rules = rules;
    return Promise.resolve();
  }
}

const empty = toPagedResult([], { page: 1, pageSize: 20, skip: 0 }, 0);

/** Read model returning empty pages; tests that need data use the integration tests. */
export const emptyReadModel: AdminReadModel = {
  listReports: () => Promise.resolve(empty),
  reportCounts: () => Promise.resolve({ total: 0, upheld: 0, lastDay: 0 }),
  filedCounts: () => Promise.resolve({ total: 0, dismissed: 0 }),
  listBans: () => Promise.resolve(empty),
  searchUsers: () => Promise.resolve(empty),
  userSessions: () => Promise.resolve([]),
  listStaff: () => Promise.resolve([]),
  listAudit: () => Promise.resolve(empty),
  reportsPerHour: (hours) => Promise.resolve(Array.from({ length: hours }, () => 0)),
  openReportsByTier: () => Promise.resolve({ critical: 1, high: 0, normal: 2, low: 0 }),
  pendingAppeals: () => Promise.resolve(3),
};

export const fixedLiveStats: LiveStats = {
  online: () => Promise.resolve(12),
  waiting: () => Promise.resolve({ text: 2, video: 1 }),
  activeSessions: () => Promise.resolve(4),
  matchesPerMinute: (minutes) => Promise.resolve(Array.from({ length: minutes }, () => 1)),
  averageWaitMs: () => Promise.resolve(1500),
};

export const noQueues: QueueInspector = { depths: () => Promise.resolve([]) };

export const staffPrincipal = (roles: Role[], overrides: Partial<Principal> = {}): Principal => ({
  kind: "user",
  subjectId: `staff-${roles.join("-")}`,
  deviceId: "staff-device",
  roles,
  emailVerified: true,
  mfa: true,
  termsVersion: "2026-10-25",
  ...overrides,
});

export function createAdminFakes() {
  const moderation = createModerationFakes();
  const identity = createTestIdentity();
  const notifier = new RecordingNotifier();
  const textRules = new InMemoryTextRules();
  const context: AdminContext = {
    reports: moderation.reports,
    banRepository: moderation.bans,
    bans: moderation.banService,
    trust: moderation.trust,
    audit: moderation.audit,
    notifier,
    textRules,
    users: identity.users,
    refreshTokens: identity.refreshTokens,
    hasher: fakeHasher,
    readModel: emptyReadModel,
    liveStats: fixedLiveStats,
    queues: noQueues,
    clock: moderation.clock,
  };

  /** Stores a report from `reporter` about `reported` (a registered account). */
  async function report(category: ReportCategory = "harassment") {
    const submitted = Report.submit(
      {
        sessionId: crypto.randomUUID(),
        mode: "video",
        category,
        note: null,
        reporter: participant("reporter"),
        reported: participant("reported", "user"),
        evidenceId: null,
      },
      moderation.clock(),
    );
    await moderation.reports.add(submitted);
    return submitted;
  }

  async function user(email: string, roles: Role[] = []) {
    const created = User.createStaff(email, "hash", roles, moderation.clock());
    await identity.users.add(created);
    return created;
  }

  return { ...moderation, identity, notifier, textRules, context, report, user };
}
