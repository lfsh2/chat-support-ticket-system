import { expect, test, type Browser } from "@playwright/test";

// Casey's private CoachOS channel: slug = "client-" + md5(user id + ":coachos")[0..10] (see the migration).
const CASEY_CHANNEL = "/c/client-4439a3da66";

async function userPage(browser: Browser, slug: string, next: string, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${slug}&next=${encodeURIComponent(next)}`);
  return page;
}

test("a client's private channel: only they and the team see it, live", async ({ browser }) => {
  const casey = await userPage(browser, "coachos", CASEY_CHANNEL);
  const staff = await userPage(browser, "agent", CASEY_CHANNEL, { width: 1280, height: 900 });
  await expect(casey.getByText("Your private space with the Alive + Free team.")).toBeVisible();
  await expect(staff.getByText("Only this client and the team can see this channel.")).toBeVisible();

  // Nested under #coachos-help, marked private.
  await casey.goto("/c");
  const nested = casey.getByRole("list", { name: "Client channels under coachos-help" });
  await expect(nested.getByRole("link", { name: /casey-coachos, private/ })).toBeVisible();
  await expect(nested.getByRole("link")).toHaveCount(1); // only her own

  await casey.goto(CASEY_CHANNEL);
  const text = `Question about my booking page ${Date.now().toString(36)}`;
  await casey.getByRole("textbox", { name: /^Message / }).fill(text);
  await casey.getByRole("button", { name: "Send message" }).click();
  await expect(staff.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible({ timeout: 10_000 });

  // Another client can't open it, even with the link.
  const bailey = await userPage(browser, "both", "/c");
  const res = await bailey.goto(CASEY_CHANNEL);
  expect(res?.status()).toBe(404);
  await expect(
    bailey.getByRole("list", { name: "Client channels under coachos-help" }).getByRole("link", { name: /casey/ }),
  ).toHaveCount(0);
});

test("admins can rename a client channel", async ({ browser }) => {
  const owner = await userPage(browser, "owner", CASEY_CHANNEL, { width: 1280, height: 900 });
  const rename = async (to: string) => {
    await owner.getByRole("button", { name: "Channel options" }).click();
    await owner.getByRole("menuitem", { name: "Rename…" }).click();
    const dialog = owner.getByRole("dialog", { name: "Rename channel" });
    await dialog.getByLabel("Channel name").fill(to);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(owner.getByText("Channel renamed.")).toBeVisible();
  };
  try {
    await rename("Casey Morgan Site");
    await expect(owner.getByRole("heading", { name: "The start of #casey-morgan-site" })).toBeVisible();
  } finally {
    await rename("casey-coachos");
  }
  // Agents don't get the menu.
  const agent = await userPage(browser, "agent", CASEY_CHANNEL, { width: 1280, height: 900 });
  await expect(agent.getByText("Only this client and the team can see this channel.")).toBeVisible();
  await expect(agent.getByRole("button", { name: "Channel options" })).toHaveCount(0);
});
