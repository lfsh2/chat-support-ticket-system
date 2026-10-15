import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { E2E_TAG, cleanupE2eData, fakeMailbox } from "./cleanup";

// Drives the real inbox pipeline through the local-only /api/dev/inbound endpoint (no Gmail).
test.beforeAll(async () => {
  await cleanupE2eData();
  await fakeMailbox(true);
});
test.afterAll(async () => {
  await fakeMailbox(false);
  await cleanupE2eData();
});

const FEED = "/c/coachos-email-ticket";
const tag = (s: string) => `${E2E_TAG} ${s} ${Date.now().toString(36)}`;

async function signedIn(browser: Browser, slug: string, next: string, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${slug}&next=${encodeURIComponent(next)}`);
  return page;
}

type Received = { outcome: string; threadId: string; ticketNumber: number | null };
async function receive(api: APIRequestContext, email: Record<string, unknown>): Promise<Received> {
  const res = await api.post("/api/dev/inbound", { data: { action: "receive", ...email } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}
async function flush(api: APIRequestContext): Promise<{ emails: { to: string; subject: string; threadId: string | null }[] }> {
  const res = await api.post("/api/dev/inbound", { data: { action: "flush" } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test("emails from strangers become cards; newsletters are dropped; clients can't see the feed", async ({ browser }) => {
  test.setTimeout(60_000);
  const staff = await signedIn(browser, "owner", FEED);
  const subject = tag("Interested in CoachOS for my practice");

  expect((await receive(staff.request, { from: "newperson@example.org", name: "Robin Lee", subject, text: "Hi! How does pricing work?" })).outcome).toBe("unmatched");
  expect(
    (await receive(staff.request, { from: "news@vendor.example", subject: tag("Our October newsletter"), text: "Deals", headers: { "list-unsubscribe": "<mailto:u@x>" } })).outcome,
  ).toBe("ignored");

  const card = staff.getByRole("article", { name: /not a client yet from Robin Lee/ }).filter({ hasText: subject });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("Hi! How does pricing work?")).toBeVisible();
  await expect(staff.getByText(/October newsletter/)).toHaveCount(0);

  await card.getByRole("button", { name: "Mark handled" }).click();
  await expect(card.getByText(/Handled by Sammi/)).toBeVisible({ timeout: 10_000 });

  const casey = await signedIn(browser, "coachos", "/c", 390);
  expect((await casey.goto(FEED))?.status()).toBe(404);
});

test("a client's email opens a ticket; the team's reply goes back by email; their reply lands in it", async ({ browser }) => {
  test.setTimeout(90_000);
  const staff = await signedIn(browser, "owner", FEED);
  const subject = tag("Booking page shows the wrong time");

  const first = await receive(staff.request, {
    from: "coachos@example.com",
    name: "Casey CoachOS",
    subject,
    text: "My booking page shows times an hour off.\n\nOn Mon, Jon <jon@x.com> wrote:\n> old quoted text",
  });
  expect(first.outcome).toBe("ticket");
  expect(first.ticketNumber).toBeTruthy();

  // Card in the feed, linking to the ticket.
  await expect(staff.getByRole("article", { name: /New email ticket from Casey CoachOS/ }).filter({ hasText: subject })).toBeVisible({ timeout: 10_000 });

  // The client sees it in Help, marked as arrived by email, without the quoted thread.
  const casey = await signedIn(browser, "coachos", `/dashboard/tickets/${first.ticketNumber}`, 390);
  await expect(casey.getByRole("log", { name: "Messages" }).getByText("My booking page shows times an hour off.")).toBeVisible();
  await expect(casey.getByText("via email")).toBeVisible();
  await expect(casey.getByText("old quoted text")).toHaveCount(0);

  // Team: an internal note (never emailed), then a reply (emailed into the same thread).
  await staff.goto(`/dashboard/tickets/${first.ticketNumber}`);
  await staff.getByRole("button", { name: "Internal note" }).click();
  await staff.getByRole("textbox", { name: "Add a note only the team can see" }).fill("Check her timezone setting");
  await staff.getByRole("button", { name: "Send message" }).click();
  await expect(staff.getByRole("log", { name: "Messages" }).getByText("Check her timezone setting")).toBeVisible();
  await staff.getByRole("button", { name: "Reply", exact: true }).click();
  await staff.getByRole("textbox", { name: /^Reply to / }).fill("Thanks Casey, which timezone is your account set to?");
  await staff.getByRole("button", { name: "Send message" }).click();
  await expect(staff.getByRole("log", { name: "Messages" }).getByText("which timezone is your account set to?")).toBeVisible();

  const out = await flush(staff.request);
  const mine = out.emails.filter((e) => e.subject.includes(subject));
  expect(mine).toHaveLength(1); // the reply only, not the internal note
  expect(mine[0].to).toContain("coachos@example.com");
  expect(mine[0].subject).toBe(`Re: ${subject}`);
  expect(mine[0].threadId).toBe(first.threadId);

  // Casey answers by email, in the same thread → it joins the ticket.
  const reply = await receive(staff.request, {
    from: "coachos@example.com",
    name: "Casey CoachOS",
    subject: `Re: ${subject}`,
    text: "It's set to London.\n\nOn Thu, Alive + Free Support <coachos@aliveandfreeconsulting.com> wrote:\n> which timezone",
    threadId: first.threadId,
  });
  expect(reply.outcome).toBe("appended");
  await expect(staff.getByRole("log", { name: "Messages" }).getByText("It's set to London.")).toBeVisible({ timeout: 10_000 });
});
