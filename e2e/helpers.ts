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
  const before = await inboxIds(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

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

  await page.goto(link!);
}
