import { z } from "zod";
import {
  defineIntegrationEvent,
  type IntegrationEvent,
  type IntegrationEventHandler,
} from "../../abstractions/messaging/integration-event.js";

/** Published when someone blocks their partner; the hot path already applied it in Redis. */
export const PartnerBlocked = defineIntegrationEvent(
  "chat.partner-blocked.v1",
  z.object({
    blockerSubjectId: z.string().min(1),
    blockerDeviceId: z.string().min(1),
    blockedSubjectId: z.string().min(1),
    blockedDeviceId: z.string().min(1),
    blockedAt: z.iso.datetime(),
  }),
);

export type PartnerBlockedPayload = z.infer<typeof PartnerBlocked.schema>;

export interface BlockRecord {
  readonly blockerSubjectId: string;
  readonly blockerDeviceId: string;
  readonly blockedSubjectId: string;
  readonly blockedDeviceId: string;
  readonly blockedAt: Date;
}

export interface BlockRepository {
  /** Idempotent: recording the same blocker/blocked pair twice keeps one record. */
  record(block: BlockRecord): Promise<void>;
}

/** Durable copy of blocks (for moderation history and Redis recovery), written off the hot path. */
export class RecordPartnerBlock implements IntegrationEventHandler<PartnerBlockedPayload> {
  constructor(private readonly blocks: BlockRepository) {}

  async handle(event: IntegrationEvent<PartnerBlockedPayload>): Promise<void> {
    await this.blocks.record({ ...event.payload, blockedAt: new Date(event.payload.blockedAt) });
  }
}
