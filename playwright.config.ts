import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Dev mode: reads .env.local but never .env.production.local (production keys).
loadEnvConfig(process.cwd(), true);

// The specs write to the database with the service-role key. Only ever against local Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(supabaseUrl)) {
  throw new Error(`E2E tests must run against local Supabase, not ${supabaseUrl || "(unset)"}. Check .env.local.`);
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 14"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "pnpm dev", url: "http://localhost:3000/login", reuseExistingServer: true },
});
