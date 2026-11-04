import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser } from "@playwright/test";
import type { Database } from "../lib/database.types";

// Admins add, edit and archive channels from the sidebar and the channel header.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function userPage(browser: Browser, as: string, viewport: { width: number; height: number }, next = "/c/general") {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${as}&next=${encodeURIComponent(next)}`);
  await page.waitForURL((url) => url.pathname === next);
  return page;
}

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to clean up non-local Supabase: ${url}`);
  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  await admin.from("channels").delete().like("slug", "e2e-%");
});

test("an admin adds a team-only Alive & Free channel, edits it and archives it; clients never see it", async ({ browser }) => {
  const owner = await userPage(browser, "owner", DESKTOP);
  const slug = `e2e-af-feed-${Date.now().toString(36)}`;

  await owner.getByRole("button", { name: "Add a channel to Alive & Free" }).first().click();
  const dialog = owner.getByRole("dialog", { name: "New channel" });
  await expect(dialog.getByRole("button", { name: "Alive & Free", pressed: true })).toBeVisible();
  await dialog.getByLabel("Name").fill(slug.replace(/-/g, " ").toUpperCase());
  await expect(dialog.getByText(`#${slug}`)).toBeVisible(); // shows the cleaned-up name
  await dialog.getByLabel("Description").fill("Emails to support@ · team only");
  await dialog.getByRole("switch").click();
  await dialog.getByRole("button", { name: "Create channel" }).click();

  await owner.waitForURL(`**/c/${slug}`);
  await expect(owner.getByText(`#${slug} is ready.`)).toBeVisible();
  await expect(owner.getByRole("link", { name: slug }).first()).toBeVisible();
  await expect(owner.getByText("Emails to support@ · team only").first()).toBeVisible();

  // Edit: new description; the program can't change.
  await owner.getByRole("button", { name: "Channel options" }).click();
  await owner.getByRole("menuitem", { name: "Edit channel…" }).click();
  const edit = owner.getByRole("dialog", { name: `Edit #${slug}` });
  await expect(edit.getByText("can't be changed after it's created")).toBeVisible();
  await edit.getByLabel("Description").fill("New emails to support@");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Channel updated.")).toBeVisible();
  await expect(owner.getByText("New emails to support@").first()).toBeVisible();

  // An Alive & Free client doesn't get it: not in the sidebar, and the address 404s.
  const alex = await userPage(browser, "alivefree", DESKTOP);
  await expect(alex.getByRole("link", { name: "community" }).first()).toBeVisible();
  await expect(alex.getByRole("link", { name: slug })).toHaveCount(0);
  await expect(alex.getByRole("button", { name: /Add a channel/ })).toHaveCount(0);
  const res = await alex.goto(`/c/${slug}`);
  expect(res?.status()).toBe(404);

  // Support staff see it, but can't add or edit channels.
  const agent = await userPage(browser, "agent", DESKTOP, `/c/${slug}`);
  await expect(agent.getByRole("heading", { name: slug }).first()).toBeVisible();
  await expect(agent.getByRole("button", { name: /Add a channel/ })).toHaveCount(0);
  await expect(agent.getByRole("button", { name: "Channel options" })).toHaveCount(0);

  // Archive: gone from the sidebar.
  await owner.getByRole("button", { name: "Channel options" }).click();
  await owner.getByRole("menuitem", { name: "Archive…" }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await owner.waitForURL((url) => url.pathname === "/c");
  await expect(owner.getByRole("link", { name: slug })).toHaveCount(0);
});

test("core channels can be edited but not archived, and the name must be new", async ({ browser }) => {
  const owner = await userPage(browser, "owner", DESKTOP);
  await owner.getByRole("button", { name: "Channel options" }).click();
  await expect(owner.getByRole("menuitem", { name: "Edit channel…" })).toBeVisible();
  await expect(owner.getByRole("menuitem", { name: "Archive…" })).toHaveCount(0);
  await owner.keyboard.press("Escape");

  await owner.getByRole("button", { name: "Add a channel to Everyone" }).first().click();
  const dialog = owner.getByRole("dialog", { name: "New channel" });
  await dialog.getByLabel("Name").fill("General");
  await dialog.getByRole("button", { name: "Create channel" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("There's already a #general channel.");
});

test("on a phone, admins add channels from the channel list", async ({ browser }) => {
  const owner = await userPage(browser, "owner", PHONE, "/c");
  await owner.getByRole("button", { name: "Add a channel to CoachOS" }).first().click();
  const sheet = owner.getByRole("dialog", { name: "New channel" });
  await expect(sheet.getByRole("button", { name: "CoachOS", pressed: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Create channel" })).toBeVisible();
  const overflow = await owner.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await owner.screenshot({ path: "test-results/new-channel-phone.png" });
});
