import { PartnerBlocked } from "../../application/features/chat/blocks.js";
import { EmailRequested } from "../../application/features/identity/events.js";
import {
  BanIssued,
  ContentFlagged,
  ReportSubmitted,
  SessionEnded,
} from "../../application/features/moderation/events.js";
import { subscriptionQueue } from "./queue-inspector.js";

/**
 * Every subscription the workers host. The workers build their consumers from these pairs and the
 * API's system-health view inspects the same queues, so the two never drift apart.
 */
export const WORKER_SUBSCRIPTIONS = {
  email: { subscriber: "notifications", definition: EmailRequested },
  blocks: { subscriber: "chat", definition: PartnerBlocked },
  scoring: { subscriber: "moderation", definition: ReportSubmitted },
  trustSessions: { subscriber: "trust", definition: SessionEnded },
  trustFlags: { subscriber: "trust", definition: ContentFlagged },
  auditBans: { subscriber: "audit", definition: BanIssued },
} as const;

export const WORKER_QUEUES: readonly string[] = Object.values(WORKER_SUBSCRIPTIONS).map(
  ({ subscriber, definition }) => subscriptionQueue(subscriber, definition.routingKey),
);
