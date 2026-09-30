import { test } from "@playwright/test";
import { signInAs } from "./helpers";

// Visual check artifacts for §14 (390px and 1280px, light and dark).
// Distinct emails per run: Supabase rate-limits repeat magic links to one address.
const EMAILS: Record<string, string> = {
  "390-light": "both@example.com",
  "390-dark": "coachos@example.com",
  "1280-light": "alivefree@example.com",
  "1280-dark": "owner@example.com",
};

for (const width of [390, 1280]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`screens @${width} ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/login");
      await page.screenshot({ path: `test-results/screens/login-${width}-${scheme}.png` });
      await signInAs(page, EMAILS[`${width}-${scheme}`]);
      await page.getByRole("button", { name: "Send message" }).waitFor();
      await page.screenshot({ path: `test-results/screens/channel-${width}-${scheme}.png` });
      if (width === 390) {
        await page.getByRole("button", { name: "Open channels" }).click();
        await page.getByRole("link", { name: /^wins/ }).waitFor();
        await page.waitForTimeout(500); // let the sheet finish sliding in
        await page.screenshot({ path: `test-results/screens/sheet-${width}-${scheme}.png` });
        await page.keyboard.press("Escape");
        await page.goto("/c");
        await page.screenshot({ path: `test-results/screens/chat-tab-${width}-${scheme}.png` });
      }
      await page.goto("/me");
      await page.screenshot({ path: `test-results/screens/me-${width}-${scheme}.png` });
    });
  }
}
