import { defineConfig } from "@playwright/test";

/** Recorder helper checks against local HTML; no app, seed, provider, or services needed. */
export default defineConfig({
  testDir: "./e2e/recording-checks",
  workers: 1,
  expect: { timeout: 1_000 },
  use: { browserName: "chromium" },
});
