import { randomUUID } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

/**
 * Two independent browsers (separate cookies, devices and sessions) share a unique interest and pass
 * the gate at the same moment, so they find each other well within the random-fallback window and
 * never pair with other tests' users.
 */
async function openGate(browser: Browser, interest: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const interests = page.getByRole("textbox", { name: "Interests" });
  await interests.fill(interest);
  await interests.press("Enter");
  await page.getByRole("button", { name: "Start text" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await dialog.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
  return page;
}

async function connectedPair(browser: Browser): Promise<[Page, Page]> {
  const interest = `e2e${randomUUID().slice(0, 8)}`;
  const pages = await Promise.all([openGate(browser, interest), openGate(browser, interest)]);
  await Promise.all(
    pages.map((page) => page.getByRole("button", { name: "Agree and continue" }).click()),
  );
  for (const page of pages) {
    await expect(page).toHaveURL(/\/chat\/text$/);
    await expect(page.getByText(`You both like ${interest}.`)).toBeVisible({ timeout: 15_000 });
  }
  return [pages[0], pages[1]];
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByLabel("Message").press("Enter");
}

const conversation = (page: Page) => page.getByRole("list", { name: "Conversation" });

test("two strangers are matched and exchange messages", async ({ browser }) => {
  const [alice, bob] = await connectedPair(browser);

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
  const [alice, bob] = await connectedPair(browser);

  await alice.keyboard.press("Escape");

  await expect(alice.getByText("Looking for someone to chat with").first()).toBeVisible();
  await expect(bob.getByText("Your partner moved on to someone else.")).toBeVisible();
  await expect(bob.getByLabel("Message")).toBeDisabled();
});

test("closing the tab immediately ends the chat for the partner", async ({ browser }) => {
  const [alice, bob] = await connectedPair(browser);

  await alice.context().close();

  await expect(bob.getByText("Your partner lost their connection.")).toBeVisible({
    timeout: 10_000,
  });
});

test("blocking ends the chat and shows a confirmation", async ({ browser }) => {
  const [alice, bob] = await connectedPair(browser);

  await alice.getByRole("button", { name: "Block" }).click();

  await expect(alice.getByText(/You blocked this person/)).toBeVisible();
  await expect(bob.getByText("Your partner left the chat.")).toBeVisible();
});

test("the chat page sends people without a session back to the start", async ({ page }) => {
  await page.goto("/chat/text");
  await expect(page.getByRole("heading", { name: "Start from the home page" })).toBeVisible();
});
