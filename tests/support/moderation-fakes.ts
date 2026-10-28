import type { RateLimitDecision, RateLimiter } from "../../src/application/abstractions/rate-limiter.js";
import type { ChatSession, Participant } from "../../src/application/features/chat/chat-types.js";
import type { Matchmaker } from "../../src/application/features/chat/matchmaker.js";
import type { BufferedMessage, RecentMessages } from "../../src/application/features/chat/recent-messages.js";
import { BanService } from "../../src/application/features/moderation/bans.js";
import { defaultModerationPolicy } from "../../src/application/features/moderation/moderation-policy.js";
import type { AccessIdentity } from "../../src/application/features/moderation/network.js";
import type {
  AuditEntry,
  AuditLog,
  BanCache,
  BanEnforcer,
  BanRepository,
  CachedBan,
  ContentClassifier,
  EventCounter,
  Evidence,
  EvidenceStore,
  ReportRepository,
  TrustStore,
} from "../../src/application/features/moderation/ports.js";
import { type Ban, type BanTarget, targetKey } from "../../src/domain/moderation/ban.js";
import type { Report, ReportScore } from "../../src/domain/moderation/report.js";
import { clampTrust, TRUST } from "../../src/domain/moderation/trust.js";
import { InMemoryRepository, RecordingEvents } from "./identity-fakes.js";

export class InMemoryBans extends InMemoryRepository<Ban> implements BanRepository {
  findActive(targets: readonly BanTarget[], now: Date): Promise<Ban[]> {
    const keys = new Set(targets.map(targetKey));
    return Promise.resolve(
      this.all().filter(
        (ban) => ban.isActive(now) && ban.targets.some((target) => keys.has(targetKey(target))),
      ),
    );
  }

  listActive(now: Date): Promise<Ban[]> {
    return Promise.resolve(this.all().filter((ban) => ban.isActive(now)));
  }
}

export class InMemoryBanCache implements BanCache {
  readonly #entries = new Map<string, Map<string, { mode: Ban["mode"]; expiresAt: number }>>();

  store(ban: Ban): Promise<void> {
    for (const target of ban.targets) {
      const entries = this.#entries.get(targetKey(target)) ?? new Map();
      entries.set(ban.id, { mode: ban.mode, expiresAt: ban.expiresAt?.getTime() ?? Infinity });
      this.#entries.set(targetKey(target), entries);
    }
    return Promise.resolve();
  }

  remove(ban: Ban): Promise<void> {
    for (const target of ban.targets) this.#entries.get(targetKey(target))?.delete(ban.id);
    return Promise.resolve();
  }

  lookup(targets: readonly BanTarget[], now: Date): Promise<CachedBan[]> {
    const found = new Map<string, CachedBan>();
    for (const target of targets)
      for (const [banId, entry] of this.#entries.get(targetKey(target)) ?? [])
        if (entry.expiresAt > now.getTime()) found.set(banId, { banId, mode: entry.mode });
    return Promise.resolve([...found.values()]);
  }
}

export class RecordingEnforcer implements BanEnforcer {
  readonly enforced: BanTarget[][] = [];

  enforce(targets: readonly BanTarget[]): Promise<void> {
    this.enforced.push([...targets]);
    return Promise.resolve();
  }
}

export class InMemoryReports extends InMemoryRepository<Report> implements ReportRepository {
  existsForSession(sessionId: string, reporterSubjectId: string): Promise<boolean> {
    return Promise.resolve(
      this.all().some(
        (report) => report.sessionId === sessionId && report.reporter.subjectId === reporterSubjectId,
      ),
    );
  }

  countAgainst(subjectId: string, since: Date): Promise<{ reports: number; distinctReporters: number }> {
    const matching = this.all().filter(
      (report) => report.reported.subjectId === subjectId && report.createdAt >= since,
    );
    return Promise.resolve({
      reports: matching.length,
      distinctReporters: new Set(matching.map((report) => report.reporter.deviceId)).size,
    });
  }
}

export class InMemoryEvidence implements EvidenceStore {
  readonly items = new Map<string, Evidence>();

  save(evidence: Evidence): Promise<void> {
    this.items.set(evidence.id, evidence);
    return Promise.resolve();
  }

  get(id: string): Promise<Evidence | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }
}

export class InMemoryTrust implements TrustStore {
  readonly scores = new Map<string, number>();

  scoreOf(keys: readonly string[]): Promise<number> {
    return Promise.resolve(Math.min(...keys.map((key) => this.scores.get(key) ?? TRUST.default)));
  }

  adjust(keys: readonly string[], delta: number): Promise<void> {
    for (const key of keys) this.scores.set(key, clampTrust((this.scores.get(key) ?? TRUST.default) + delta));
    return Promise.resolve();
  }
}

export class RecordingAudit implements AuditLog {
  readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

export class InMemoryCounter implements EventCounter {
  readonly #events = new Map<string, number[]>();

  constructor(private readonly now: () => number) {}

  increment(key: string, windowMs: number): Promise<number> {
    const events = (this.#events.get(key) ?? []).filter((at) => this.now() - at < windowMs);
    events.push(this.now());
    this.#events.set(key, events);
    return Promise.resolve(events.length);
  }
}

export class InMemoryRecentMessages implements RecentMessages {
  readonly #messages = new Map<string, BufferedMessage[]>();

  append(sessionId: string, message: BufferedMessage): Promise<void> {
    this.#messages.set(sessionId, [...(this.#messages.get(sessionId) ?? []), message]);
    return Promise.resolve();
  }

  list(sessionId: string): Promise<BufferedMessage[]> {
    return Promise.resolve(this.#messages.get(sessionId) ?? []);
  }
}

export class FixedClassifier implements ContentClassifier {
  constructor(private readonly score: ReportScore = { image: null, text: null, labels: [] }) {}

  classify(): Promise<ReportScore> {
    return Promise.resolve(this.score);
  }
}

export const unlimited: RateLimiter = {
  consume: (): Promise<RateLimitDecision> =>
    Promise.resolve({ allowed: true, remaining: 99, retryAfterMs: 0 }),
};

/** Sessions known to the fake matchmaker; only what reports need. */
export class FakeMatchmaker implements Pick<Matchmaker, "findSession" | "block"> {
  readonly sessions = new Map<string, ChatSession>();
  readonly blocks: [Participant, Participant][] = [];

  findSession(sessionId: string): Promise<ChatSession | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }

  block(blocker: Participant, blocked: Participant): Promise<void> {
    this.blocks.push([blocker, blocked]);
    return Promise.resolve();
  }
}

export const participant = (subjectId: string, kind: Participant["kind"] = "anonymous"): Participant => ({
  subjectId,
  deviceId: kind === "anonymous" ? subjectId : `device-of-${subjectId}`,
  kind,
  networkHash: `net-${subjectId}`,
  subnetHash: `subnet-${subjectId}`,
});

export const identityOf = (who: Participant): AccessIdentity => ({ ...who });

export function createModerationFakes(start = new Date("2026-10-26T12:00:00Z")) {
  let now = start.getTime();
  const clock = () => new Date(now);
  const bans = new InMemoryBans();
  const cache = new InMemoryBanCache();
  const enforcer = new RecordingEnforcer();
  const events = new RecordingEvents();
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    bans,
    cache,
    enforcer,
    events,
    banService: new BanService(bans, cache, enforcer, events, clock),
    reports: new InMemoryReports(),
    evidence: new InMemoryEvidence(),
    trust: new InMemoryTrust(),
    audit: new RecordingAudit(),
    counter: new InMemoryCounter(() => now),
    recentMessages: new InMemoryRecentMessages(),
    matchmaker: new FakeMatchmaker(),
    policy: defaultModerationPolicy(),
  };
}
