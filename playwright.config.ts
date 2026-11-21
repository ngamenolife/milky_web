import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /e2e\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-out.mjs",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
