import { createTransport, type Transporter } from "nodemailer";
import type { EmailMessage } from "../../application/features/notifications/email-templates.js";
import type { EmailSender } from "../../application/features/notifications/send-requested-email.js";
import type { WorkersConfig } from "../config/config.js";

/** SMTP delivery (Mailpit locally; any SMTP relay in production). */
export class SmtpEmailSender implements EmailSender {
  readonly #transport: Transporter;

  constructor(private readonly settings: WorkersConfig["smtp"]) {
    this.#transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      ...(settings.user && settings.password
        ? { auth: { user: settings.user, pass: settings.password } }
        : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.#transport.sendMail({ from: this.settings.from, ...message });
  }

  close(): void {
    this.#transport.close();
  }
}
