import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:8180"
  },
  webServer: {
    command: "node scripts/start-production.mjs --port=8180",
    url: "http://127.0.0.1:8180/api/health",
    reuseExistingServer: false,
    timeout: 15_000
  }
});
