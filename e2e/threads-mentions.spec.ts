import { expect, test, type Browser, type Page } from "@playwright/test";
import { cleanupE2eData, E2E_TAG } from "./cleanup";

// Phase 3: threads, @mentions, the Inbox, typing, presence and ⌘K.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function userPage(browser: Browser, as: string, viewport: { width: number; height: number }, next = "/c/general") {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${as}&next=${encodeURIComponent(next)}`);
  await page.waitForURL((url) => url.pathname === next);
  return page;
}

const unique = (label: string) => `${E2E_TAG} ${label} ${Date.now().toString(36)}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const row = (page: Page, text: string) => page.locator('[id^="message-"]', { hasText: text });

test.afterAll(cleanupE2eData);

test("mentioning someone puts it in their Inbox, and tapping it jumps to the highlighted message", async ({ browser }) => {
  const casey = await userPage(browser, "coachos", PHONE);
  const bailey = await userPage(browser, "both", DESKTOP, "/dashboard");

  // Casey types "@Bai", picks Bailey from the suggestions and sends.
  const text = unique("can you check this");
  const box = casey.getByRole("textbox", { name: "Message #general" });
  await box.fill("hey @Bai");
  const option = casey.getByRole("option", { name: /Bailey Both/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(box).toHaveValue("hey @Bailey Both ");
  await box.pressSequentially(text);
  await casey.getByRole("button", { name: "Send message" }).click();
  await expect(row(casey, text).getByText("@Bailey Both")).toBeVisible();

  // Bailey's sidebar shows an unread Inbox item, live.
  const inboxLink = bailey.getByRole("link", { name: /^Inbox/ });
  await expect(inboxLink).toContainText(/\d/, { timeout: 5_000 });
  await inboxLink.click();
  const item = bailey.getByRole("link", { name: new RegExp(`Casey CoachOS mentioned you in #general.*${esc(text)}`) });
  await expect(item).toBeVisible();
  await item.click();

  // Lands on the exact message, highlighted.
  await expect(bailey).toHaveURL(/\/c\/general\?m=[0-9a-f-]{36}$/);
  const target = row(bailey, text);
  await expect(target).toBeInViewport();
  await expect(target).toHaveClass(/message-highlight/);

  // …and the item is now read.
  await bailey.goto("/inbox");
  await expect(bailey.getByRole("link", { name: new RegExp(`Casey CoachOS mentioned you.*${esc(text)}`) })).not.toContainText("unread");

  await casey.context().close();
  await bailey.context().close();
});

test("people outside a channel aren't offered as mentions", async ({ browser }) => {
  const casey = await userPage(browser, "coachos", DESKTOP, "/c/coachos-help");
  await casey.getByRole("textbox", { name: "Message #coachos-help" }).fill("@");
  await expect(casey.getByRole("option", { name: /Bailey Both/ })).toBeVisible();
  // Alex is Alive & Free only, so can't see #coachos-help.
  await expect(casey.getByRole("option", { name: /Alex/ })).toHaveCount(0);
  await casey.context().close();
});

test("threads: reply on desktop, the other person sees it live on a phone and gets an Inbox item", async ({ browser }) => {
  const casey = await userPage(browser, "coachos", PHONE);
  const bailey = await userPage(browser, "both", DESKTOP);

  const parentText = unique("thread starter");
  await casey.getByRole("textbox", { name: "Message #general" }).fill(parentText);
  await casey.getByRole("button", { name: "Send message" }).click();

  // Bailey opens the thread from the hover toolbar; the URL is shareable.
  const parent = row(bailey, parentText);
  await expect(parent).toBeVisible({ timeout: 5_000 });
  await parent.hover();
  await parent.getByRole("button", { name: "Reply in thread" }).click();
  await expect(bailey).toHaveURL(/\/c\/general\/t\/[0-9a-f-]{36}$/);
  const panel = bailey.getByRole("complementary", { name: "Thread" });
  await expect(panel.getByText("No replies yet. Start the conversation.")).toBeVisible();

  const reply = unique("first reply");
  await panel.getByRole("textbox", { name: "Reply in thread" }).fill(reply);
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByText(reply)).toBeVisible();

  // Casey sees "1 reply" appear and opens the thread drawer.
  const replies = row(casey, parentText).getByRole("button", { name: "1 reply" });
  await expect(replies).toBeVisible({ timeout: 5_000 });

  // The reply also landed in Casey's Inbox.
  await casey.goto("/inbox");
  const item = casey.getByRole("link", { name: new RegExp(`Bailey Both replied to a thread in #general.*${esc(reply)}`) });
  await expect(item).toBeVisible();
  await item.click();
  await expect(casey).toHaveURL(/\/c\/general\/t\/[0-9a-f-]{36}\?m=/);
  const drawer = casey.getByRole("dialog", { name: "Thread" });
  await expect(drawer.getByText(reply)).toBeVisible();

  // Casey answers from the drawer; Bailey's open panel updates live.
  const answer = unique("thanks");
  await drawer.getByRole("textbox", { name: "Reply in thread" }).fill(answer);
  await drawer.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByText(answer)).toBeVisible({ timeout: 5_000 });

  // Closing the drawer goes back to the channel.
  await drawer.getByRole("button", { name: "Close thread" }).click();
  await expect(casey).toHaveURL(/\/c\/general$/);

  await casey.context().close();
  await bailey.context().close();
});

test("typing shows up for the other person, and online people get a dot", async ({ browser }) => {
  const casey = await userPage(browser, "coachos", DESKTOP);
  const bailey = await userPage(browser, "both", DESKTOP);

  // Typing at a human pace: signals go out every few seconds while someone keeps typing.
  await casey.getByRole("textbox", { name: "Message #general" }).pressSequentially("hello there, quick question", { delay: 200 });
  await expect(bailey.getByText("Casey CoachOS is typing…")).toBeVisible({ timeout: 5_000 });

  const text = unique("presence check");
  await casey.getByRole("button", { name: "Send message" }).click();
  await expect(bailey.getByText("Casey CoachOS is typing…")).toHaveCount(0, { timeout: 7_000 });

  await casey.getByRole("textbox", { name: "Message #general" }).fill(text);
  await casey.getByRole("button", { name: "Send message" }).click();
  await expect(row(bailey, text)).toBeVisible({ timeout: 5_000 });
  // Casey's latest group header (the row with the avatar) carries the online dot.
  // (Not asserting it disappears: other specs may still hold a Casey session open.)
  const caseyHeader = bailey.locator('[id^="message-"]', { hasText: "Casey CoachOS" }).last();
  await expect(caseyHeader.getByRole("img", { name: "Online" })).toBeVisible({ timeout: 5_000 });

  await casey.context().close();
  await bailey.context().close();
});

test("⌘K jumps to a channel, and the search button opens it on a phone", async ({ browser }) => {
  const desk = await userPage(browser, "both", DESKTOP);
  await desk.keyboard.press("ControlOrMeta+k");
  await desk.getByPlaceholder("Search channels, tickets and pages…").fill("wins");
  await desk.keyboard.press("Enter");
  await expect(desk).toHaveURL(/\/c\/wins$/);
  await desk.context().close();

  const phone = await userPage(browser, "coachos", PHONE);
  await phone.getByRole("button", { name: "Search" }).click();
  await phone.getByPlaceholder("Search channels, tickets and pages…").fill("inbox");
  await phone.getByRole("option", { name: /Inbox/ }).click();
  await expect(phone).toHaveURL(/\/inbox$/);
  await phone.context().close();
});
