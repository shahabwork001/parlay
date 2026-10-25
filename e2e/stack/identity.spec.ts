import { expect, test } from "@playwright/test";
import { Secret, TOTP } from "otpauth";
import { linkFromEmail, registerAndVerify, signIn, uniqueEmail } from "./support";

test("the age and terms gate creates an anonymous session before chat", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const anonymousSession = page.waitForResponse("**/api/v1/auth/anonymous");
  await page.getByRole("button", { name: "Start text" }).click();
  const dialog = page.getByRole("dialog", { name: "Before you start" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Agree and continue" })).toBeDisabled();

  await dialog.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await dialog.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
  await dialog.getByRole("button", { name: "Agree and continue" }).click();

  expect((await anonymousSession).status()).toBe(200);
  await expect(page).toHaveURL(/\/chat\/text$/);
});

test("the gate is not shown again once accepted in this session", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start video" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await dialog.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
  await dialog.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page).toHaveURL(/\/chat\/video$/);

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start text" }).click();

  await expect(page).toHaveURL(/\/chat\/text$/);
});

test("register, confirm email, sign in and stay signed in after reload", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("account");
  await registerAndVerify(page, request, email);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Confirmed")).toBeVisible();

  await page.reload();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("wrong passwords are rejected with a clear message", async ({ page, request }) => {
  const email = uniqueEmail("wrong");
  await registerAndVerify(page, request, email);

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("enable two-factor authentication and sign in with a code", async ({ page, request }) => {
  const email = uniqueEmail("totp");
  await registerAndVerify(page, request, email);
  await signIn(page, email);

  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const secret = (await page.locator("code").innerText()).trim();
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  await page.getByLabel("Code from your app").fill(totp.generate());
  await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();

  await expect(
    page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem"),
  ).toHaveCount(10);
  await page.getByRole("button", { name: "I have saved them" }).click();
  await expect(page.getByText("You are asked for a code each time you sign in.")).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await signIn(page, email);
  await page.getByLabel("Authentication code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email)).toBeVisible();
});

test("forgot password sends a reset link that sets a new password", async ({ page, request }) => {
  const email = uniqueEmail("reset");
  await registerAndVerify(page, request, email);

  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();

  await page.goto(await linkFromEmail(request, email, "/reset-password"));
  await page.getByLabel("New password", { exact: true }).fill("a completely new password");
  await page.getByLabel("Confirm new password").fill("a completely new password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText(/signed out everywhere/)).toBeVisible();

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a completely new password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});
