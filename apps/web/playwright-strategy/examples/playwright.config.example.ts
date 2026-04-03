// Example only: adjust to your real config.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 4,
  projects: [
    {
      name: "setup-auth",
      testMatch: /.*auth\.setup\.ts/,
    },
    {
      name: "chromium-readonly",
      dependencies: ["setup-auth"],
      grep: /@readonly|@smoke|@core/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/readonly.json",
      },
    },
    {
      name: "chromium-write",
      dependencies: ["setup-auth"],
      grep: /@write|@core|@full/,
      use: {
        ...devices["Desktop Chrome"],
        // concrete file should be selected in a custom fixture by worker index
        storageState: "e2e/.auth/writer-worker-0.json",
      },
    },
    {
      name: "firefox-readonly",
      dependencies: ["setup-auth"],
      grep: /@readonly|@core/,
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/readonly.json",
      },
    },
  ],
});
