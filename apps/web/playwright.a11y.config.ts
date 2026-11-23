import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

const A11Y_REPORT_DIR = process.env.A11Y_REPORT_DIR || "a11y-report";

/**
 * WCAG 2.1 AA audit: the regular E2E setup (database, auth) plus the scans in e2e/a11y-audit.
 * Writes a scored report to a11y-report/. Fails only on views scanned with `regressionCheck`.
 */
export default defineConfig({
  ...baseConfig,
  // Separate from test-results/ so an audit never wipes artifacts of a parallel E2E run.
  outputDir: `${A11Y_REPORT_DIR}/test-results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${A11Y_REPORT_DIR}/html`, open: "never" }],
    ["./e2e/a11y-audit/wcag-audit.reporter.ts", { outputDir: A11Y_REPORT_DIR }],
  ],
  projects: [
    ...(baseConfig.projects ?? []).filter(({ name }) => name?.startsWith("setup-")),
    {
      name: "a11y-audit",
      testDir: "./e2e/a11y-audit",
      testMatch: /.*\.audit\.ts$/,
      dependencies: ["setup-auth"],
      fullyParallel: true,
      // Each test walks a whole path and scans every view on it (axe, Tab walk, reflow).
      timeout: 6 * 60 * 1000,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
