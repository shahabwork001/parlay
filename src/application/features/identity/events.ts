import { z } from "zod";
import { defineIntegrationEvent } from "../../abstractions/messaging/integration-event.js";

export const EMAIL_TEMPLATES = ["verify-email", "account-exists", "password-reset"] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/** Published by the API, delivered by the workers' notification consumer. */
export const EmailRequested = defineIntegrationEvent(
  "notifications.email-requested.v1",
  z.object({
    to: z.email(),
    template: z.enum(EMAIL_TEMPLATES),
    link: z.url().optional(),
  }),
);

export type EmailRequestedPayload = z.infer<typeof EmailRequested.schema>;
