import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_TAG, cleanupE2eData } from "./cleanup";

test.beforeAll(cleanupE2eData);
test.afterAll(cleanupE2eData);

const CASEY_CHANNEL = "/c/client-4439a3da66";

async function signedIn(browser: Browser, slug: string, next: string, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${slug}&next=${encodeURIComponent(next)}`);
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/"));
  return page;
}

async function post(page: Page, text: string) {
  await page.getByRole("textbox", { name: /^Message / }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible();
}

const row = (page: Page, text: string) => page.locator('[id^="message-"]').filter({ hasText: text });

test("the team turns a client's chat message into a ticket", async ({ browser }) => {
  test.setTimeout(90_000);
  const text = `${E2E_TAG} Can I get help with my portal logins? ${Date.now().toString(36)}`;

  const casey = await signedIn(browser, "coachos", CASEY_CHANNEL, 390);
  await post(casey, text);
  // Clients never get the option.
  await expect(row(casey, text).getByRole("button", { name: "Create a ticket from this message" })).toHaveCount(0);

  const staff = await signedIn(browser, "agent", CASEY_CHANNEL);
  const msg = row(staff, text).first();
  await expect(msg).toBeVisible({ timeout: 10_000 });
  await msg.hover();
  await msg.getByRole("button", { name: "Create a ticket from this message" }).click();

  const dialog = staff.getByRole("dialog", { name: "Create a ticket" });
  await expect(dialog.getByLabel("Subject")).toHaveValue(text);
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(staff.getByText(/Ticket #\d+ created\./)).toBeVisible();

  // The message now links to its ticket, and can't be converted twice.
  const chip = msg.getByRole("link", { name: /Ticket #\d+/ });
  await expect(chip).toBeVisible();
  const number = (await chip.textContent())!.match(/\d+/)![0];
  await expect(msg.getByRole("button", { name: "Create a ticket from this message" })).toHaveCount(0);
  await expect(staff.getByRole("note").filter({ hasText: `opened ticket #${number} from a message here` })).toBeVisible();

  // The client sees the link live and finds the ticket, with her message, under Help.
  await expect(row(casey, text).first().getByRole("link", { name: `Ticket #${number}` })).toBeVisible({ timeout: 10_000 });
  await casey.goto(`/dashboard/tickets/${number}`);
  await expect(casey.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible();
  await expect(casey.getByText("from #casey-coachos", { exact: true })).toBeVisible();
  await expect(casey.getByRole("note").filter({ hasText: "opened this ticket from #casey-coachos" })).toBeVisible();
});

test("in a shared channel, other clients don't see the ticket link", async ({ browser }) => {
  test.setTimeout(90_000);
  const text = `${E2E_TAG} Is the Thursday call recorded? ${Date.now().toString(36)}`;
  const casey = await signedIn(browser, "coachos", "/c/general", 390);
  await post(casey, text);

  const staff = await signedIn(browser, "owner", "/c/general");
  const msg = row(staff, text).first();
  await expect(msg).toBeVisible({ timeout: 10_000 });
  await msg.click({ button: "right" });
  await staff.getByRole("menuitem", { name: "Create ticket" }).click();
  await staff.getByRole("dialog", { name: "Create a ticket" }).getByRole("button", { name: "Create ticket" }).click();
  await expect(msg.getByRole("link", { name: /Ticket #\d+/ })).toBeVisible({ timeout: 10_000 });

  const bailey = await signedIn(browser, "both", "/c/general");
  await expect(row(bailey, text).first()).toBeVisible();
  await expect(row(bailey, text).first().getByRole("link", { name: /Ticket #/ })).toHaveCount(0);
});

test("follow-up messages (no header) can be turned into a ticket too", async ({ browser }) => {
  test.setTimeout(90_000);
  const first = `${E2E_TAG} Quick one about my calendar ${Date.now().toString(36)}`;
  const second = `${E2E_TAG} and the booking page shows the wrong times ${Date.now().toString(36)}`;
  const casey = await signedIn(browser, "coachos", CASEY_CHANNEL, 390);
  await post(casey, first);
  await post(casey, second); // same author within 5 minutes → grouped, no header

  const staff = await signedIn(browser, "agent", CASEY_CHANNEL);
  const msg = row(staff, second).first();
  await expect(msg).toBeVisible({ timeout: 10_000 });
  await msg.hover();
  await msg.getByRole("button", { name: "Create a ticket from this message" }).click();
  await expect(staff.getByRole("dialog", { name: "Create a ticket" }).getByLabel("Subject")).toHaveValue(second);
});
