import { TRUST_ADJUSTMENTS, trustKeys } from "../../../domain/moderation/trust.js";
import type {
  IntegrationEvent,
  IntegrationEventHandler,
} from "../../abstractions/messaging/integration-event.js";
import type { ContentFlaggedPayload, SessionEndedPayload } from "./events.js";
import type { TrustStore } from "./ports.js";

/** Sessions shorter than this say nothing about behaviour (most skips happen in seconds). */
export const CLEAN_SESSION_MIN_MS = 60_000;

/**
 * Trust adjustments are small and frequent, so they run off the hot path. Delivery is at least once:
 * stable effect ids make per-subject updates retry-safe, including partial multi-key failures.
 */
export class RewardCleanSession implements IntegrationEventHandler<SessionEndedPayload> {
  constructor(private readonly trust: TrustStore) {}

  async handle(event: IntegrationEvent<SessionEndedPayload>): Promise<void> {
    const { startedAt, endedAt, participants } = event.payload;
    if (Date.parse(endedAt) - Date.parse(startedAt) < CLEAN_SESSION_MIN_MS) return;
    await Promise.all(
      participants.map((participant) =>
        this.trust.adjust(
          trustKeys(participant),
          TRUST_ADJUSTMENTS.cleanSession,
          `session:${event.payload.sessionId}`,
        ),
      ),
    );
  }
}

export class PenaliseFlaggedContent implements IntegrationEventHandler<ContentFlaggedPayload> {
  constructor(private readonly trust: TrustStore) {}

  async handle(event: IntegrationEvent<ContentFlaggedPayload>): Promise<void> {
    const delta =
      event.payload.source === "nsfw-screening"
        ? TRUST_ADJUSTMENTS.contentFlag
        : TRUST_ADJUSTMENTS.blockedMessage;
    await this.trust.adjust(trustKeys(event.payload), delta, `flag:${event.eventId}`);
  }
}
