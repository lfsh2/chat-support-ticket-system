import { expect, type Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

type MailpitList = { messages: { ID: string }[] };

async function inboxIds(email: string): Promise<Set<string>> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const list: MailpitList = await res.json();
  return new Set(list.messages.map((m) => m.ID));
}

/** Requests a magic link through the UI, then follows it from the local Mailpit inbox. */
export async function signInAs(page: Page, email: string) {
  const link = await requestMagicLink(page, email);
  await page.goto(link);
  // The link opens a "Continue" page; signing in waits for the tap (link previews can't use it up).
  await page.getByRole("button", { name: "Continue to Client Hub" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
}

/** Asks for a sign-in link on /login and returns the link from the email that arrives. */
export async function requestMagicLink(page: Page, email: string): Promise<string> {
  const before = await inboxIds(email);
  await page.goto("/login");
  await page.getByRole("button", { name: /Email me a sign-in link instead/ }).click();
  await page.getByLabel("Email").fill(email);
  // Supabase allows one link per address per second; tests sign the same people in back to back.
  await expect(async () => {
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000, intervals: [1_000] });

  let link: string | undefined;
  await expect
    .poll(async () => {
      const fresh = [...(await inboxIds(email))].find((id) => !before.has(id));
      if (!fresh) return undefined;
      const full: { HTML: string } = await (await fetch(`${MAILPIT}/api/v1/message/${fresh}`)).json();
      link = full.HTML.match(/href="([^"]*auth\/confirm[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
      return link;
    }, { timeout: 15_000 })
    .toBeTruthy();

  return link!;
}

/** Sets a user's password directly (local Supabase only; playwright.config refuses anything else). */
export async function setPassword(email: string, password: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await admin.from("profiles").select("id").eq("email", email).single();
  const { error } = await admin.auth.admin.updateUserById(data!.id, { password });
  if (error) throw error;
}
