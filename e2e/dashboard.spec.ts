import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_TAG, cleanupE2eData } from "./cleanup";

test.beforeAll(cleanupE2eData);
test.afterAll(cleanupE2eData);

// Signs in with the dev link (no email round-trip) — needs DEV_LOGIN=true locally.
async function userPage(browser: Browser, slug: string, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
  const page = await context.newPage();
  await page.goto(`/auth/dev?as=${slug}&next=/dashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

const unique = (label: string) => `${label} ${Date.now().toString(36)}`;
const tagged = (label: string) => `${E2E_TAG} ${unique(label)}`;
const inLog = (page: Page, text: string) => page.getByRole("log", { name: "Messages" }).getByText(text);
const statusShown = (page: Page, label: string) => page.getByText(label, { exact: true }).filter({ visible: true }).first();

test("member opens a ticket on mobile; staff works it; internal notes stay internal", async ({ browser }) => {
  test.setTimeout(90_000); // two people, a dozen steps
  const member = await userPage(browser, "both");
  const staff = await userPage(browser, "agent", { width: 1280, height: 900 });
  const subject = tagged("Booking page shows the wrong timezone");

  // --- Member: Get help → program → category → details (Bailey has both programs) ---
  const started = Date.now();
  await member.goto("/dashboard/tickets");
  await member.getByRole("button", { name: "Get help" }).first().click();
  const flow = member.getByRole("dialog", { name: "Get help" });
  await flow.getByRole("button", { name: "CoachOS" }).click();
  await flow.getByRole("button", { name: "Tech / CoachOS setup" }).click();
  await flow.getByLabel("Subject").fill(subject);
  await flow.getByLabel("Tell us more").fill("Clients in London see times an hour off.");
  await flow.getByRole("button", { name: "Send to the team" }).click();
  await expect(member).toHaveURL(/\/dashboard\/tickets\/\d+$/);
  expect(Date.now() - started).toBeLessThan(30_000);
  await expect(member.getByText(/Ticket #\d+ opened\./)).toBeVisible();
  const number = member.url().split("/").pop()!;
  await expect(statusShown(member, "Sent")).toBeVisible();

  // --- Staff: it's in the unassigned queue straight away ---
  await staff.goto("/dashboard/tickets?view=unassigned");
  await staff.getByRole("link", { name: subject }).click();
  await expect(staff).toHaveURL(new RegExp(`/dashboard/tickets/${number}$`));

  // Pick it up → system event in the stream.
  await staff.getByRole("complementary", { name: "Ticket details" }).getByRole("button", { name: "Assign to me" }).click();
  await expect(staff.getByRole("note").filter({ hasText: "picked up this ticket" })).toBeVisible();

  // Internal note, then a reply.
  const note = unique("Probably the DST offset bug");
  await staff.getByRole("button", { name: "Internal note" }).click();
  await staff.getByRole("textbox", { name: "Add a note only the team can see" }).fill(note);
  await staff.getByRole("button", { name: "Send message" }).click();
  await expect(inLog(staff, note)).toBeVisible();

  const reply = unique("Thanks Bailey, which page are you looking at?");
  await staff.getByRole("button", { name: "Reply", exact: true }).click();
  await staff.getByRole("textbox", { name: /^Reply to / }).fill(reply);
  await staff.getByRole("button", { name: "Send message" }).click();
  await expect(inLog(staff, reply)).toBeVisible();

  // Waiting on the client.
  const panel = staff.getByRole("complementary", { name: "Ticket details" });
  await panel.getByRole("combobox", { name: "Status" }).click();
  await staff.getByRole("option", { name: "Waiting on client" }).click();
  await expect(staff.getByRole("note").filter({ hasText: "waiting on a reply from the client" })).toBeVisible();

  // --- Member: sees the reply live, never the note; replying reopens ---
  await expect(inLog(member, reply)).toBeVisible({ timeout: 10_000 });
  await member.reload();
  await expect(statusShown(member, "Waiting on you")).toBeVisible();
  await expect(member.getByText(note)).toHaveCount(0);

  await member.getByRole("textbox", { name: "Add a message for the team" }).fill("The public booking page.");
  await member.getByRole("button", { name: "Send message" }).click();
  await expect(staff.getByRole("note").filter({ hasText: "marked this open" })).toBeVisible({ timeout: 10_000 });

  // --- Staff: a follow-up task from the ticket shows up on the board ---
  const taskTitle = tagged("Check timezone handling on booking page");
  await panel.getByRole("button", { name: "Add task" }).click();
  const dialog = staff.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("What needs doing?").fill(taskTitle);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(panel.getByRole("button", { name: taskTitle, exact: true })).toBeVisible();

  await staff.goto("/dashboard/tasks");
  const todo = staff.getByRole("region", { name: "To do" });
  await expect(todo.getByRole("button", { name: taskTitle, exact: true })).toBeVisible();
  await todo.getByRole("button", { name: `Actions for "${taskTitle}"` }).click();
  await staff.getByRole("menuitem", { name: "In progress" }).click();
  await expect(staff.getByRole("region", { name: "In progress" }).getByRole("button", { name: taskTitle, exact: true })).toBeVisible();

  // Tidy up: tick it off.
  await staff.getByRole("button", { name: `Mark "${taskTitle}" as done` }).click();
  await expect(staff.getByRole("region", { name: "Done" }).getByRole("button", { name: taskTitle, exact: true })).toBeVisible();
});

test("tasks are team-only", async ({ browser }) => {
  const member = await userPage(browser, "coachos");
  const res = await member.goto("/dashboard/tasks");
  expect(res?.status()).toBe(404);
  await member.goto("/dashboard");
  await expect(member.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Tasks" })).toHaveCount(0);
});

test("old /help links land on the dashboard", async ({ browser }) => {
  const member = await userPage(browser, "coachos");
  await member.goto("/help");
  await expect(member).toHaveURL(/\/dashboard\/tickets$/);
});
