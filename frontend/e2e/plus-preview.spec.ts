import { expect, test } from "@playwright/test";

test("Plus preview records explicit interest without offering checkout", async ({ page }) => {
  let joined = false;
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        accessToken: "test-browser-session",
        accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
        principal: {
          kind: "user",
          roles: [],
          emailVerified: true,
          mfa: false,
          termsVersion: "2026-10-28",
        },
      },
    }),
  );
  await page.route("**/api/v1/billing/plans", (route) =>
    route.fulfill({
      json: {
        plan: {
          id: "parley-plus",
          name: "Parley Plus",
          amountMinor: 999,
          currency: "USD",
          interval: "month",
          entitlements: ["preference_presets"],
        },
        checkoutEnabled: false,
        mock: false,
      },
    }),
  );
  await page.route("**/api/v1/product/activity", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/premium/preview", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/premium/waitlist", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ consent: true });
      joined = true;
    }
    if (route.request().method() === "DELETE") {
      joined = false;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: { joined } });
  });
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Parley Plus � pricing preview" })).toBeVisible();
  const join = page.getByRole("button", { name: "Join Waitlist" });
  await expect(join).toBeDisabled();
  await expect(page.getByRole("button", { name: /checkout|subscribe/i })).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await join.click();
  await expect(page.getByRole("status")).toContainText("You are on the Plus waitlist");
  await page.getByRole("button", { name: "Leave waitlist and remove my signup" }).click();
  await expect(join).toBeDisabled();
});
