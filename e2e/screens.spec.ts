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
      await page.getByRole("navigation", { name: "Channels" }).waitFor();
      await page.screenshot({ path: `test-results/screens/hub-${width}-${scheme}.png`, fullPage: true });
    });
  }
}
