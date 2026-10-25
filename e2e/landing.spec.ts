import { expect, test } from "@playwright/test";

test("landing page shows the value proposition and both start actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Talk to someone new." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start video" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start text" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground rules" })).toBeVisible();
});

test("interests persist across reloads", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Interests").fill("travel");
  await page.getByLabel("Interests").press("Enter");
  await page.reload();

  await expect(page.getByRole("list", { name: "Selected interests" })).toContainText("travel");
});
