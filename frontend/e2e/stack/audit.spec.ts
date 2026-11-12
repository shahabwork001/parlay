import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { connectedTextPair, createStaff, signInAsStaff } from "./support";

/*
 * Accessibility and responsive audit of every page a visitor can reach: WCAG 2.1 AA rules (axe)
 * in light and dark themes, and no horizontal scrolling at 360 px.
 */

const PAGES = [
  "/",
  "/pricing",
  "/subscription",
  "/age-verification",
  "/terms",
  "/privacy",
  "/guidelines",
  "/safety",
  "/faq",
  "/contact",
  "/status",
  "/login",
  "/register",
  "/forgot-password",
  "/settings",
  "/account",
  "/chat/text",
  "/admin",
] as const;

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  // Let client components settle (session restore, skeletons to content).
  await page.waitForTimeout(300);
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

const violations = async (page: Page) =>
  (await axe(page)).violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`,
  );

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await open(page, path);
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test.describe("360 px wide", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of PAGES) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await open(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

const ADMIN_PAGES = [
  "/admin",
  "/admin/reports",
  "/admin/bans",
  "/admin/users",
  "/admin/rules",
  "/admin/site",
  "/admin/audit",
  "/admin/billing",
  "/admin/system",
] as const;

test.describe("signed-in screens", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("admin shell fills the viewport when content is scrolled at different screen sizes", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signInAsStaff(page, createStaff("Admin"));
      for (const viewport of [
        { width: 1880, height: 900 },
        { width: 1253, height: 478 },
        { width: 360, height: 740 },
      ]) {
        await page.setViewportSize(viewport);
        for (const route of ["/admin", "/admin/reports"]) {
          await open(page, route);
          const content = page.getByRole("region", { name: "Admin content", exact: true });
          await content.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const box = await content.boundingBox();
          expect(box).not.toBeNull();
          expect(Math.abs(box!.y + box!.height - viewport.height)).toBeLessThanOrEqual(1);
          await expect(page.getByRole("banner")).toBeInViewport();
          expect(
            await page.evaluate(() => document.documentElement.scrollHeight),
          ).toBeLessThanOrEqual(viewport.height);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(viewport.width);
        }
      }
    } finally {
      await context.close();
    }
  });

  test("admin pages have no WCAG 2.1 AA violations in either theme and fit 360 px", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAsStaff(page, createStaff("Admin"));
    for (const path of ADMIN_PAGES) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, path);
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        expect(await violations(page), `${path} (${colorScheme})`).toEqual([]);
      }
      await page.setViewportSize({ width: 360, height: 740 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await context.close();
  });

  test("a live text chat has no WCAG 2.1 AA violations", async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const [alice] = await connectedTextPair(browser, contexts);
    await alice.getByLabel("Message").fill("hello");
    await alice.getByLabel("Message").press("Enter");
    expect(await violations(alice)).toEqual([]);
    await Promise.all(contexts.map((context) => context.close()));
  });
});
