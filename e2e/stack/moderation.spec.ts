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

test("messages with slurs are not delivered and contact details are removed", async ({
  browser,
}) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);

  await send(alice, "you are a f4ggot");
  await expect(
    alice.getByText("That message breaks the Community Guidelines and was not sent."),
  ).toBeVisible();
  await expect(conversation(alice).getByText("Not delivered")).toBeVisible();

  await send(alice, "add me on snap: night_owl99");
  await expect(conversation(bob).getByText("add me on [contact removed]")).toBeVisible();
  await expect(conversation(bob).getByText(/f4ggot/)).toHaveCount(0);
});

test("a minor-safety report ends the chat and suspends the reported person, who can appeal", async ({
  browser,
}) => {
  const [alice, bob] = await connectedTextPair(browser, openContexts);
  await send(bob, "how old are you");
  await expect(conversation(alice).getByText("how old are you")).toBeVisible();

  await alice.getByRole("button", { name: "Report" }).click();
  const dialog = alice.getByRole("dialog", { name: "Report this person" });
  await expect(dialog.getByText(/last messages of this chat/)).toBeVisible();
  await dialog.getByRole("radio", { name: "Appears to be under 18" }).check();
  await dialog.getByRole("button", { name: "Send report" }).click();

  await expect(alice.getByText(/your report was sent to our moderators/)).toBeVisible();
  await expect(alice.getByRole("button", { name: "Report" })).toHaveCount(0);

  await expect(bob).toHaveURL(/\/banned$/, { timeout: 15_000 });
  await expect(
    bob.getByRole("heading", { name: "Your access to chat is suspended" }),
  ).toBeVisible();
  await expect(bob.getByText("Until the review is complete")).toBeVisible();

  await bob.getByLabel("Appeal this decision").fill("I am an adult and did nothing wrong here.");
  await bob.getByRole("button", { name: "Send appeal" }).click();
  await expect(bob.getByText(/is waiting for a moderator/)).toBeVisible();

  // Reconnecting is refused too: the chat page sends the suspended person straight back.
  await bob.goto("/chat/text");
  await expect(bob).toHaveURL(/\/banned$/, { timeout: 15_000 });
});
