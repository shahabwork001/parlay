import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
export const PASSWORD = "correct horse battery staple";

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@example.com`;

interface MailpitSearch {
  messages: { ID: string }[];
}

/** Polls Mailpit until an email reaches `to`, then returns the first link to `path` in it. */
export async function linkFromEmail(
  request: APIRequestContext,
  to: string,
  path: string,
): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const { messages } = (await search.json()) as MailpitSearch;
        const id = messages[0]?.ID;
        if (!id) return null;
        const message = (await (
          await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)
        ).json()) as { Text: string };
        link = new RegExp(`https?://\\S+${path}\\?token=\\S+`).exec(message.Text)?.[0];
        return link ?? null;
      },
      { timeout: 20_000, message: `waiting for an email to ${to}` },
    )
    .not.toBeNull();
  return link!;
}

export async function registerAndVerify(
  page: Page,
  request: APIRequestContext,
  email: string,
): Promise<void> {
  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await page.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await linkFromEmail(request, email, "/verify-email"));
  await expect(page.getByText("Your email is confirmed.")).toBeVisible();
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login?next=/account", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}
