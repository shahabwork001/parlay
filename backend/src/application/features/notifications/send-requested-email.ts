import type {
  IntegrationEvent,
  IntegrationEventHandler,
} from "../../abstractions/messaging/integration-event.js";
import type { EmailRequestedPayload } from "../identity/events.js";
import { type EmailMessage, renderEmail } from "./email-templates.js";

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Renders and sends transactional email requested by the API. Failures are retried by the consumer. */
export class SendRequestedEmail implements IntegrationEventHandler<EmailRequestedPayload> {
  constructor(private readonly sender: EmailSender) {}

  async handle(event: IntegrationEvent<EmailRequestedPayload>): Promise<void> {
    await this.sender.send(renderEmail(event.payload));
  }
}
