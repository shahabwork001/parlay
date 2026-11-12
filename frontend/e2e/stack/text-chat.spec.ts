import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { connectedTextPair, openTextGate } from "./support";

test.describe.configure({ mode: "serial" });

const openContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(openContexts.splice(0).map((context) => context.close()));
});

async function send(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByLabel("Message").press("Enter");
}

const conversation = (page: Page) => page.getByRole("list", { name: "Conversation" });

test("two strangers are matched and exchange messages", async ({ browser }) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);

  await alice.getByLabel("Message").pressSequentially("hel");
  await expect(bob.getByText("Stranger is typing")).toBeVisible();

  await send(alice, "hello from alice");
  await expect(conversation(bob).getByText("hello from alice")).toBeVisible();
  await expect(bob.getByText("Stranger is typing")).toBeHidden();

  await send(bob, "hi alice, visit www.example.com");
  await expect(conversation(alice).getByText("hi alice, visit [link removed]")).toBeVisible();
  await expect(conversation(bob).getByText("hi alice, visit [link removed]")).toBeVisible();
});

test("Next ends the chat for the partner and starts a new search", async ({ browser }) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);

  await alice.keyboard.press("Escape");

  await expect(alice.getByText("Looking for someone to chat with").first()).toBeVisible();
  await expect(bob.getByText("Your partner moved on to someone else.")).toBeVisible();
  await expect(bob.getByLabel("Message")).toBeDisabled();
});

test("closing the tab immediately ends the chat for the partner", async ({ browser }) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);

  await alice.context().close();

  await expect(bob.getByText("Your partner lost their connection.")).toBeVisible({
    timeout: 10_000,
  });
});

test("blocking ends the chat and shows a confirmation", async ({ browser }) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);

  await alice.getByRole("button", { name: "Block" }).click();

  await expect(alice.getByText(/You blocked this person/)).toBeVisible();
  await expect(bob.getByText("Your partner left the chat.")).toBeVisible();
});

test("the chat page sends people without a session back to the start", async ({ page }) => {
  await page.goto("/chat/text");
  await expect(page.getByRole("heading", { name: "Start from the home page" })).toBeVisible();
});

test("one tab owns chat and closing it cleans up even with another idle chat tab", async ({
  browser,
}) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);
  const interest = await alice.evaluate(
    () =>
      JSON.parse(localStorage.getItem("parley.preferences") ?? "{}").state.interests[0] as string,
  );
  const replacement = await alice.context().newPage();
  await replacement.goto("/chat/text", { waitUntil: "networkidle" });
  await expect(alice.getByLabel("Message")).toBeDisabled();
  await expect(alice.getByText(/another tab/)).toBeVisible();
  await expect(bob.getByText("Your partner left the chat.")).toBeVisible();
  const carol = await openTextGate(browser, openContexts, interest);
  await carol.getByRole("button", { name: "Agree and continue" }).click();
  await expect(replacement.getByLabel("Message")).toBeEnabled({ timeout: 15_000 });
  await expect(carol.getByLabel("Message")).toBeEnabled();
  const idle = await alice.context().newPage();
  await idle.goto("/chat/video", { waitUntil: "networkidle" });
  await expect(idle.getByRole("heading", { name: "Check your camera" })).toBeVisible();
  await replacement.close();
  await expect(carol.getByText("Your partner lost their connection.")).toBeVisible({
    timeout: 15_000,
  });
});

test("a dropped connection ends the old chat and can explicitly start a fresh search", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const [alice, bob] = await connectedTextPair(browser, openContexts);
  await alice.context().setOffline(true);
  await expect(bob.getByText("Your partner lost their connection.")).toBeVisible({
    timeout: 25_000,
  });
  await expect(alice.getByLabel("Message")).toBeDisabled();
  const reconnected = alice.waitForEvent("websocket", { timeout: 20_000 });
  await alice.context().setOffline(false);
  const websocket = await reconnected;
  await websocket.waitForEvent("framereceived", {
    predicate: (frame) => String(frame.payload).startsWith("40"),
    timeout: 15_000,
  });
  await alice.getByRole("button", { name: /^Next/ }).click();
  await expect(alice.getByText("Looking for someone to chat with").first()).toBeVisible();
});

test("Adult Chat and real billing remain unavailable in the deployed free MVP", async ({
  browser,
}) => {
  const page = await openTextGate(browser, openContexts, "closedadultgate");
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.getByRole("button", { name: /^Adult Chat.*18\+$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Adult Chat.*18\+$/ }).click();
  await page.getByRole("button", { name: "Start again" }).click();
  await page.getByRole("button", { name: /^I consent.*Search Adult Chat$/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Adult Chat is unavailable");
  await expect(page.getByLabel("Message")).toBeDisabled();
  await page.goto("/pricing");
  await expect(page.getByRole("button", { name: /checkout|subscribe/i })).toHaveCount(0);
});
