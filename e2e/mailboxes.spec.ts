import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import type { Database } from "../lib/database.types";
import { E2E_TAG, cleanupE2eData, fakeMailbox } from "./cleanup";

// Several mailboxes: each feeds its own team-only channel and program, and answers from its own address.

const SUPPORT = "support-e2e@example.com";
const FEED_SLUG = "e2e-support-feed";
const QUIET_SLUG = "e2e-team-notes";
const PLACEHOLDER_TOKEN = "e2e-placeholder";
const tag = (s: string) => `${E2E_TAG} ${s} ${Date.now().toString(36)}`;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to touch non-local Supabase: ${url}`);
  return createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
}

let quietChannelId = "";

test.beforeAll(async () => {
  const db = admin();
  await cleanupE2eData();
  await fakeMailbox(true);
  await db.from("channels").delete().in("slug", [FEED_SLUG, QUIET_SLUG]);
  const { data: feed } = await db
    .from("channels")
    .insert({ slug: FEED_SLUG, name: FEED_SLUG, program: "alive_free", staff_only: true, position: 90 })
    .select("id")
    .single();
  const { data: quiet } = await db
    .from("channels")
    .insert({ slug: QUIET_SLUG, name: QUIET_SLUG, description: "Team notes", program: null, staff_only: true, position: 91 })
    .select("id")
    .single();
  quietChannelId = quiet!.id;
  await db.from("mail_connections").insert({ email: SUPPORT, refresh_token_enc: PLACEHOLDER_TOKEN, channel_id: feed!.id, program: "alive_free" });
});

test.afterAll(async () => {
  const db = admin();
  await cleanupE2eData();
  await db.from("mail_connections").delete().eq("email", SUPPORT);
  await db.from("channels").delete().in("slug", [FEED_SLUG, QUIET_SLUG]);
  await fakeMailbox(false);
});

async function signedIn(browser: Browser, slug: string, next: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${slug}&next=${encodeURIComponent(next)}`);
  await page.waitForURL((u) => u.pathname === next);
  return page;
}

async function dev(api: APIRequestContext, data: Record<string, unknown>) {
  const res = await api.post("/api/dev/inbound", { data });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test("an email to support@ opens an Alive & Free ticket, cards its own channel, and is answered from support@", async ({ browser }) => {
  test.setTimeout(90_000);
  const staff = await signedIn(browser, "owner", `/c/${FEED_SLUG}`);
  await expect(staff.getByText(SUPPORT).first()).toBeVisible();
  await expect(staff.getByText(`Every email to ${SUPPORT} lands here.`)).toBeVisible();

  // Bailey has both programs: mail to support@ (Alive & Free) opens an Alive & Free ticket.
  const subject = tag("My community login isn't working");
  const got = await dev(staff.request, { action: "receive", inbox: SUPPORT, from: "both@example.com", name: "Bailey Both", subject, text: "Can't get in." });
  expect(got.outcome).toBe("ticket");
  const { data: ticket } = await admin().from("tickets").select("program").eq("number", got.ticketNumber).single();
  expect(ticket?.program).toBe("alive_free");

  // The card lands in the support feed, not in #coachos-email-ticket.
  await expect(staff.getByRole("article", { name: /New email ticket from Bailey Both/ }).filter({ hasText: subject })).toBeVisible({ timeout: 10_000 });
  await staff.goto("/c/coachos-email-ticket");
  await expect(staff.getByText(subject)).toHaveCount(0);

  // The team's reply says where it goes out from, and only support@ sends it.
  await staff.goto(`/dashboard/tickets/${got.ticketNumber}`);
  await expect(staff.getByText(`Your reply will also be emailed to both@example.com from ${SUPPORT}.`)).toBeVisible();
  await staff.getByRole("textbox", { name: /^Reply to / }).fill("Try resetting your password from the sign-in page.");
  await staff.getByRole("button", { name: "Send message" }).click();
  await expect(staff.getByRole("log", { name: "Messages" }).getByText("Try resetting your password")).toBeVisible();

  const fromCoachos = await dev(staff.request, { action: "flush" });
  expect(fromCoachos.emails.filter((e: { subject: string }) => e.subject.includes(subject))).toHaveLength(0);
  const fromSupport = await dev(staff.request, { action: "flush", inbox: SUPPORT });
  const sent = fromSupport.emails.filter((e: { subject: string }) => e.subject.includes(subject));
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toContain("both@example.com");
  expect(sent[0].threadId).toBe(got.threadId);
});

test("admins can connect Gmail on any team-only channel; support staff aren't asked to", async ({ browser }) => {
  const owner = await signedIn(browser, "owner", `/c/${QUIET_SLUG}`);
  const connect = owner.getByRole("button", { name: "Connect Gmail" });
  await expect(connect).toHaveAttribute("href", `/api/gmail/connect?channel=${quietChannelId}`);
  await expect(owner.getByText("Team notes. Only the team can see this channel.")).toBeVisible();
  await expect(owner.getByText(/CoachOS@AliveAndFreeConsulting\.com/i)).toHaveCount(0);

  const agent = await signedIn(browser, "agent", `/c/${QUIET_SLUG}`);
  await expect(agent.getByText("Team notes. Only the team can see this channel.")).toBeVisible();
  await expect(agent.getByRole("button", { name: "Connect Gmail" })).toHaveCount(0);
  await expect(agent.getByText(/No mailbox is connected/)).toHaveCount(0);

  // Connecting a client channel or a channel members can see is refused before Google.
  const res = await owner.request.get(`/api/gmail/connect?channel=${quietChannelId}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const where = res.headers()["location"] ?? "";
  expect(where.includes("accounts.google.com") || where.includes("gmail=not_configured")).toBe(true);
});
