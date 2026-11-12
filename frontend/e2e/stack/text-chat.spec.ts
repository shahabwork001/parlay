import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { connectedTextPair } from "./support";

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
