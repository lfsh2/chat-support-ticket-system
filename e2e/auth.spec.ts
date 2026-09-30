import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("unknown emails are turned away with a helpful message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("We couldn't find an active membership for this email.")).toBeVisible();
});

test("signed-out visitors are sent to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("CoachOS-only member sees CoachOS and shared channels, not Alive & Free", async ({ page }) => {
  await signInAs(page, "coachos@example.com");
  await expect(page).toHaveURL(/\/c\/general$/);
  await page.goto("/c");
  await expect(page.getByRole("link", { name: /^coachos-help/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^general/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^community/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^resources/ })).toHaveCount(0);
  // Direct URL to another program's channel is a friendly 404, not a leak.
  await page.goto("/c/community");
  await expect(page.getByText("isn't part of your membership")).toBeVisible();
});

test("Alive & Free member does not see CoachOS channels", async ({ page }) => {
  await signInAs(page, "alivefree@example.com");
  await page.goto("/c");
  await expect(page.getByRole("link", { name: /^community/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^coachos-help/ })).toHaveCount(0);
});

test("lapsed members are turned away at the door", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("lapsed@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("We couldn't find an active membership for this email.")).toBeVisible();
});

test("staff can sign in without a membership", async ({ page }) => {
  await signInAs(page, "agent@example.com");
  await page.goto("/me");
  await expect(page.getByText("You're on the team")).toBeVisible();
});

test("a membership that lapses mid-session redirects to /access-ended", async ({ page }) => {
  const rest = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/rest/v1/memberships?email=eq.coachos@example.com`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const setStatus = (status: string) =>
    fetch(rest, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

  await signInAs(page, "coachos@example.com");
  await expect(page).toHaveURL(/\/c\/general$/);
  try {
    await setStatus("canceled");
    await page.reload();
    await expect(page).toHaveURL(/\/access-ended$/);
    await expect(page.getByRole("heading", { name: "Your membership has ended" })).toBeVisible();
  } finally {
    await setStatus("active");
  }
});
