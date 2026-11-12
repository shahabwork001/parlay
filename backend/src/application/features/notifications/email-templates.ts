import type { EmailRequestedPayload, EmailTemplate } from "../identity/events.js";

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface TemplateContent {
  readonly subject: string;
  readonly paragraphs: readonly string[];
  readonly action?: string;
  readonly footer: string;
}

const CONTENT: Record<EmailTemplate, TemplateContent> = {
  "verify-email": {
    subject: "Confirm your email for Parley",
    paragraphs: [
      "Confirm this email address to finish creating your Parley account. The link expires in 24 hours.",
    ],
    action: "Confirm email",
    footer: "If you did not create an account, you can ignore this email.",
  },
  "account-exists": {
    subject: "You already have a Parley account",
    paragraphs: [
      "Someone tried to create a Parley account with this email address, but an account already exists.",
      "If that was you, sign in instead. You can reset your password from the sign-in page if you have forgotten it.",
    ],
    action: "Sign in",
    footer: "If this was not you, no action is needed. Your account has not changed.",
  },
  "password-reset": {
    subject: "Reset your Parley password",
    paragraphs: ["Use the link below to choose a new password. The link expires in 1 hour and works once."],
    action: "Reset password",
    footer:
      "If you did not ask for a password reset, you can ignore this email. Your password has not changed.",
  },
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain, accessible transactional emails: no images, no tracking, a text part for every message. */
export function renderEmail(request: EmailRequestedPayload): EmailMessage {
  const content = CONTENT[request.template];
  const actionText = content.action && request.link ? `${content.action}: ${request.link}` : null;
  const text = [...content.paragraphs, actionText, content.footer, "Parley"].filter(Boolean).join("\n\n");

  const button =
    content.action && request.link
      ? `<p><a href="${escapeHtml(request.link)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(content.action)}</a></p>
<p style="color:#52525b;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(request.link)}</p>`
      : "";
  const html = `<!doctype html>
<html lang="en"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5;max-width:520px;margin:0 auto;padding:24px">
${content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
${button}
<p style="color:#52525b;font-size:13px">${escapeHtml(content.footer)}</p>
<p style="color:#52525b;font-size:13px">Parley</p>
</body></html>`;

  return { to: request.to, subject: content.subject, text, html };
}
