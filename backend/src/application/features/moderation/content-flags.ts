import type { EventPublisher } from "../../abstractions/messaging/integration-event.js";
import type { Clock } from "../identity/ports.js";
import type { BanService } from "./bans.js";
import { ContentFlagged } from "./events.js";
import type { ModerationPolicy } from "./moderation-policy.js";
import { type AccessIdentity, personalTargets } from "./network.js";
import type { EventCounter } from "./ports.js";

export type FlagOutcome = "recorded" | "banned";

/**
 * The client's on-device screening flagged the person's own video (it is already blurred for the
 * partner). Repeated flags within the window lead to an automatic temporary ban.
 */
export class RecordContentFlag {
  constructor(
    private readonly counter: EventCounter,
    private readonly bans: BanService,
    private readonly events: EventPublisher,
    private readonly policy: ModerationPolicy,
    private readonly clock: Clock,
  ) {}

  async execute(identity: AccessIdentity, score: number): Promise<FlagOutcome> {
    const flags = await this.counter.increment(
      `moderation.flags:${identity.deviceId}`,
      this.policy.flagWindowMs,
    );
    await this.events.publish(ContentFlagged, {
      subjectId: identity.subjectId,
      deviceId: identity.deviceId,
      kind: identity.kind,
      source: "nsfw-screening",
      score,
      flaggedAt: this.clock().toISOString(),
    });
    if (flags < this.policy.flagBanThreshold) return "recorded";

    const ban = await this.bans.issueAutomatic(
      personalTargets(identity),
      "repeated-flags",
      this.policy.automaticBanMs,
    );
    return ban ? "banned" : "recorded";
  }
}
