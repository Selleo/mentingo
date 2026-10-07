import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "regression.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5198",
    browserName: "chromium",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "corepack pnpm exec vite --config phishing-preview/vite.config.ts",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: true,
  },
});
