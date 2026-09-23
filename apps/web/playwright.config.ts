import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the actual static export (`out/`), served as a plain static
 * site — matching what's really deployed (S3 + CloudFront), not `next dev`.
 * `npm run build` must have produced `out/` before this runs (the CI job
 * already does; locally run `npm run build` first, or `npm run test:e2e`
 * which does both).
 *
 * There is no local /arrange backend to point at (see CLAUDE.md — no dev
 * environment, no Lambda emulation), so these tests hit the real deployed
 * API (baked into the static build from .env.production at build time).
 * Traffic is currently near-zero and the API's own throttle (5 req/s) caps
 * the blast radius; revisit this if that stops being true.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx serve out -l 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
