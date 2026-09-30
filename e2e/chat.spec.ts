import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function userPage(browser: Browser, email: string, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  const page = await context.newPage();
  await signInAs(page, email);
  return page;
}

const unique = (label: string) => `${label} ${Date.now().toString(36)}`;
const inLog = (page: Page, text: string) => page.getByRole("log", { name: "Messages" }).getByText(text);

async function send(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: /^Message #/ });
  await box.fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("two browsers see each other's messages and reactions instantly", async ({ browser }) => {
  const a = await userPage(browser, "coachos@example.com");
  const b = await userPage(browser, "both@example.com", { width: 1280, height: 800 });
  await a.goto("/c/general");
  await b.goto("/c/general");
  await expect(b.getByRole("heading", { name: "The start of #general" })).toBeVisible();

  const text = unique("Hello from Casey");
  await send(a, text);
  await expect(inLog(a, text)).toBeVisible();
  await expect(inLog(b, text)).toBeVisible({ timeout: 5_000 });
  // Screen readers hear about it too.
  await expect(b.locator("[aria-live=polite]").filter({ hasText: text })).toHaveCount(1);

  // B reacts via the desktop hover toolbar; A sees it.
  const row = b.locator('[id^="message-"]', { hasText: text });
  await row.hover();
  await row.getByRole("button", { name: "React with 👍" }).click();
  await expect(a.locator('[id^="message-"]', { hasText: text }).getByRole("button", { name: /👍 1 reaction/ })).toBeVisible({
    timeout: 5_000,
  });

  await a.context().close();
  await b.context().close();
});

test("unread badges appear for new messages and clear on read", async ({ browser }) => {
  const a = await userPage(browser, "coachos@example.com");
  const b = await userPage(browser, "both@example.com");
  await a.goto("/c/general");
  await b.goto("/c/wins");
  // Make sure A starts with #wins read (wait for the read receipt to land).
  const marked = a.waitForResponse((r) => r.url().includes("mark_channel_read") && r.ok());
  await a.goto("/c/wins");
  await marked;
  await a.goto("/c/general");
  const chatTab = a.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Chat/ });
  await expect(chatTab).toHaveText("Chat");

  await send(b, unique("Big win today"));

  await expect(chatTab).toContainText("1", { timeout: 5_000 });
  await a.getByRole("button", { name: "Open channels" }).click();
  await expect(a.getByRole("link", { name: "wins, 1 unread" })).toBeVisible();

  await a.getByRole("link", { name: "wins, 1 unread" }).click();
  await expect(a).toHaveURL(/\/c\/wins$/);
  await expect(a.getByRole("separator", { name: "New messages" })).toBeVisible();
  await expect(chatTab).toHaveText("Chat");

  await a.context().close();
  await b.context().close();
});

test("members can edit and delete their own messages", async ({ browser }) => {
  const page = await userPage(browser, "coachos@example.com", { width: 1280, height: 800 });
  await page.goto("/c/coachos-help");
  const text = unique("Typo mesage");
  await send(page, text);
  const row = page.locator('[id^="message-"]', { hasText: text });
  await expect(row).toBeVisible();
  await expect(row).not.toHaveClass(/opacity-60/);

  await row.hover();
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit message" }).click();
  const fixed = text.replace("mesage", "message");
  await page.getByRole("textbox", { name: "Edit message" }).fill(fixed);
  await page.keyboard.press("Enter");
  const edited = page.locator('[id^="message-"]', { hasText: fixed });
  await expect(edited).toContainText("(edited)");

  await edited.hover();
  await edited.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete message" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(inLog(page, fixed)).toHaveCount(0);
  await expect(page.getByText("This message was deleted.").last()).toBeVisible();

  await page.context().close();
});

test("members can't post in #announcements", async ({ browser }) => {
  const page = await userPage(browser, "coachos@example.com");
  await page.goto("/c/announcements");
  await expect(page.getByText("Only the team posts in #announcements")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Message #/ })).toHaveCount(0);
  await page.context().close();
});

test("composer and tabs fit a 360px screen with no horizontal scroll", async ({ browser }) => {
  const page = await userPage(browser, "both@example.com", { width: 360, height: 740 });
  await page.goto("/c/general");
  const composer = page.getByRole("button", { name: "Send message" });
  await expect(composer).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.context().close();
});
