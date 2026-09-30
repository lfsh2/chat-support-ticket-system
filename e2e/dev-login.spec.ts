import { expect, test } from "@playwright/test";

test("dev panel signs in as a seeded user without email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Casey/ }).click();
  await expect(page).toHaveURL(/\/c\/general$/);
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
});

test("dev panel still respects membership rules", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Lee/ }).click();
  await expect(page).toHaveURL(/\/access-ended$/);
});
