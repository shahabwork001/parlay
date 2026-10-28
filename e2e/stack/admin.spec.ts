import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { TOTP } from "otpauth";
import { connectedTextPair } from "./support";

/*
 * The full moderation loop from the brief: a stranger is reported in chat, a moderator sees the
 * report in the admin queue and bans them, and the banned person is blocked from chatting.
 */

test.describe.configure({ mode: "serial", timeout: 90_000 });

const openContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(openContexts.splice(0).map((context) => context.close()));
});

interface StaffCredentials {
  email: string;
  password: string;
  totpSecret: string;
}

/** A fresh staff account with two-factor enabled, created with the operator tool in the API container. */
function createStaff(role: "Moderator" | "Admin"): StaffCredentials {
  const email = `e2e-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
  const output = execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "api",
      "node",
      "dist/tools/create-staff.js",
      "--email",
      email,
      "--role",
      role,
    ],
    { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" },
  );
  return JSON.parse(output.trim().split("\n").at(-1) ?? "{}") as StaffCredentials;
}

async function signInAsStaff(page: Page, staff: StaffCredentials) {
  await page.goto("/login?next=/admin", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(staff.email);
  await page.getByLabel("Password").fill(staff.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const code = new TOTP({ secret: staff.totpSecret, digits: 6, period: 30 }).generate();
  await page.getByLabel("Authentication code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 });
}

test("a reported stranger is banned from the admin queue and can no longer chat", async ({
  browser,
}) => {
  const staff = createStaff("Moderator");
  const [alice, bob] = await connectedTextPair(browser, openContexts);
  const note = `e2e harassment ${randomUUID().slice(0, 8)}`;

  await alice.getByRole("button", { name: "Report" }).click();
  const dialog = alice.getByRole("dialog", { name: "Report this person" });
  await dialog.getByRole("radio", { name: "Harassment or bullying" }).check();
  await dialog.getByRole("textbox", { name: /Anything else/ }).fill(note);
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(alice.getByText(/your report was sent to our moderators/)).toBeVisible();

  const moderatorContext = await browser.newContext();
  openContexts.push(moderatorContext);
  const moderator = await moderatorContext.newPage();
  await signInAsStaff(moderator, staff);

  await moderator.getByRole("link", { name: "Moderation queue" }).click();
  const item = moderator.getByRole("button", { name: new RegExp(note) });
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
  await expect(moderator.getByText(`“${note}”`).last()).toBeVisible();

  await moderator.keyboard.press("b");
  const ban = moderator.getByRole("dialog", { name: "Ban this person" });
  await ban.getByRole("radio", { name: "7 days" }).check();
  await ban.getByRole("button", { name: "Ban" }).click();
  await expect(ban).toBeHidden();

  // Bob was still on the chat page: the ban disconnects him and shows the notice.
  await expect(bob).toHaveURL(/\/banned$/, { timeout: 15_000 });
  await expect(bob.getByText("Harassing or bullying other people.")).toBeVisible();
  await bob.goto("/chat/text");
  await expect(bob).toHaveURL(/\/banned$/, { timeout: 15_000 });

  // The report left the open queue; it is listed as decided. (Moderators cannot open the audit log.)
  await moderator.getByRole("button", { name: "Decided" }).click();
  await expect(moderator.getByRole("button", { name: new RegExp(note) })).toContainText("banned");
  await moderator.getByRole("link", { name: "Moderation queue" }).click();
  await expect(moderator.getByRole("link", { name: "Audit log" })).toHaveCount(0);
});

test("admins can pause chat with maintenance mode and an announcement", async ({ browser }) => {
  const staff = createStaff("Admin");
  const adminContext = await browser.newContext();
  openContexts.push(adminContext);
  const admin = await adminContext.newPage();
  await signInAsStaff(admin, staff);

  const setMaintenance = async (on: boolean) => {
    await admin.goto("/admin/site", { waitUntil: "networkidle" });
    const toggle = admin.getByRole("switch", { name: /Pause all chats/ });
    if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
    await admin.getByLabel("Message (optional)").fill(on ? "Back in ten minutes." : "");
    await admin
      .getByLabel("Banner text (leave empty for none)")
      .fill(on ? "We are upgrading Parley." : "");
    await admin.getByRole("button", { name: "Save settings" }).click();
    await expect(admin.getByText(/^Saved./)).toBeVisible();
  };

  try {
    await setMaintenance(true);
    const visitorContext = await browser.newContext();
    openContexts.push(visitorContext);
    const visitor = await visitorContext.newPage();
    // The public configuration is cached for up to 15 seconds.
    await expect(async () => {
      await visitor.goto("/", { waitUntil: "networkidle" });
      await expect(visitor.getByText("We are upgrading Parley.")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await expect(visitor.getByText("Back in ten minutes.").first()).toBeVisible();
    await expect(visitor.getByRole("button", { name: "Start video" })).toBeDisabled();
    await expect(visitor.getByRole("button", { name: "Start text" })).toBeDisabled();
  } finally {
    await setMaintenance(false);
  }
});

test("visitors without a staff session get the staff sign-in instead of the admin area", async ({
  browser,
}) => {
  const context = await browser.newContext();
  openContexts.push(context);
  const page = await context.newPage();
  await page.goto("/admin", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
});
