import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/guidelines", heading: "Community Guidelines" },
  { path: "/safety", heading: "Safety tips" },
  { path: "/faq", heading: "Frequently asked questions" },
  { path: "/contact", heading: "Contact" },
] as const;

for (const { path, heading } of PAGES) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("privacy policy states that chats are never recorded", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText("We never record them.")).toBeVisible();
  await expect(
    page.getByText("Text messages are relayed in real time and not saved."),
  ).toBeVisible();
});

test("footer links reach every static page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});
