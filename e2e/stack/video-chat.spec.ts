import { randomUUID } from "node:crypto";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

// Two browsers with live video per test: serial and generous, then close everything.
test.describe.configure({ mode: "serial", timeout: 60_000 });

const openContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(openContexts.splice(0).map((context) => context.close()));
});

/** Opens the landing page with a unique interest, passes the gate for video and reaches preflight. */
async function openVideoPreflight(
  browser: Browser,
  interest: string,
  relayOnly: boolean,
): Promise<Page> {
  const context = await browser.newContext();
  openContexts.push(context);
  if (relayOnly) {
    await context.addInitScript(() => {
      localStorage.setItem(
        "parley.settings",
        JSON.stringify({
          state: { cameraId: null, microphoneId: null, relayOnly: true, matchSound: false },
          version: 1,
        }),
      );
    });
  }
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const interests = page.getByRole("textbox", { name: "Interests" });
  await interests.fill(interest);
  await interests.press("Enter");
  await page.getByRole("button", { name: "Start video" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await dialog.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
  await dialog.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page).toHaveURL(/\/chat\/video$/);
  await expect(page.getByRole("heading", { name: "Check your camera" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start video chat" })).toBeEnabled();
  return page;
}

/** Waits until the stranger's video element is actually rendering frames. */
async function expectRemoteVideoPlaying(page: Page) {
  const remote = page.getByRole("figure", { name: "Stranger" }).locator("video");
  await expect
    .poll(async () => remote.evaluate((video: HTMLVideoElement) => video.videoWidth), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

async function connectedVideoPair(browser: Browser, relayOnly = false): Promise<[Page, Page]> {
  const interest = `video${randomUUID().slice(0, 8)}`;
  const pages = await Promise.all([
    openVideoPreflight(browser, interest, relayOnly),
    openVideoPreflight(browser, interest, relayOnly),
  ]);
  await Promise.all(
    pages.map((page) => page.getByRole("button", { name: "Start video chat" }).click()),
  );
  for (const page of pages) await expectRemoteVideoPlaying(page);
  return [pages[0], pages[1]];
}

test("preflight shows a mirrored camera preview and device choices", async ({ browser }) => {
  const page = await openVideoPreflight(browser, `solo${randomUUID().slice(0, 8)}`, false);

  const preview = page.getByRole("figure", { name: "Your camera" }).locator("video");
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBeGreaterThan(0);
  await expect(preview).toHaveClass(/-scale-x-100/);
  await expect(page.getByRole("combobox", { name: "Camera" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Microphone" })).toBeVisible();
});

test("two strangers see each other and the connection quality", async ({ browser }) => {
  const [alice, bob] = await connectedVideoPair(browser);

  for (const page of [alice, bob]) {
    await expect(
      page.getByRole("toolbar", { name: "Call controls" }).getByRole("status"),
    ).toBeVisible({
      timeout: 10_000,
    });
  }
});

test("relay-only mode connects through the TURN server", async ({ browser }) => {
  const [alice] = await connectedVideoPair(browser, true);

  const indicator = alice.getByRole("toolbar", { name: "Call controls" }).getByRole("status");
  await expect(indicator).toHaveAttribute("title", /relayed/, { timeout: 15_000 });
});

test("turning the camera off shows the partner a camera-off state", async ({ browser }) => {
  const [alice, bob] = await connectedVideoPair(browser);

  await alice.getByRole("button", { name: "Turn camera off" }).click();

  await expect(bob.getByRole("figure", { name: "Stranger" })).toContainText("Camera off");
  await expect(alice.getByRole("button", { name: "Turn camera on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Next ends the call for the partner", async ({ browser }) => {
  const [alice, bob] = await connectedVideoPair(browser);

  await alice.getByRole("button", { name: /^Next/ }).click();

  await expect(bob.getByRole("figure", { name: "Stranger" })).toContainText("Chat ended");
});
