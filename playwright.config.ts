import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end regression tests (tests/e2e). Runs against the dev server on
 * port 3000, reusing it when it is already running.
 *
 * E2E_BASE_URL overrides the origin, e.g. the LAN address a phone uses:
 *   E2E_BASE_URL=http://192.168.0.94:3000 npm run test:e2e
 * which exercises allowedDevOrigins in next.config.ts (a blocked origin never
 * hydrates, so the drawer test fails).
 *
 * Uses the installed Chrome (channel "chrome"), so no browser download.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "phone-375",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        channel: "chrome",
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- -H 0.0.0.0",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
