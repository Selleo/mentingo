import path from "path";
import { fileURLToPath } from "url";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import { RETRY_COUNT, WORKER_COUNT } from "./e2e/playwright.constants";

import type { PlaywrightTestConfig } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const TEST_DATABASE_URL = "postgresql://test_user:test_password@localhost:54321/test_db";
const TEST_LMS_DATABASE_URL =
  "postgresql://lms_app_user:replace_with_strong_password@localhost:54321/test_db";

process.env.DATABASE_URL ||= TEST_DATABASE_URL;
process.env.LMS_DATABASE_URL ||= TEST_LMS_DATABASE_URL;

const baseURL = process.env.CI
  ? "http://localhost:5173"
  : process.env.VITE_APP_URL || "https://tenant1.lms.localhost";

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? RETRY_COUNT : 0,
  workers: WORKER_COUNT,
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL,
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
    launchOptions: {
      args: [
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--ignore-ssl-errors",
        "--disable-web-security",
        "--allow-insecure-localhost",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    },
  },
  projects: [
    {
      name: "setup-db",
      testMatch: /.*db\.setup\.ts/,
    },
    {
      name: "setup-auth",
      testMatch: /.*auth\.setup\.ts/,
      dependencies: ["setup-db"],
    },
    {
      name: "chromium",
      testDir: "./e2e/specs",
      testMatch: /.*\.(spec|test)\.ts$/,
      dependencies: ["setup-auth"],
      fullyParallel: true,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "firefox",
      testDir: "./e2e/specs",
      testMatch: /.*\.(spec|test)\.ts$/,
      dependencies: ["setup-auth"],
      fullyParallel: true,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
};

if (process.env.CI) {
  config.webServer = [
    {
      command: "cd ../api && pnpm run build && pnpm db:migrate && pnpm db:seed",
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        LMS_DATABASE_URL: TEST_LMS_DATABASE_URL,
        MODE: "test",
        DISABLE_RATE_LIMITING: "true",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
      },
      reuseExistingServer: false,
      stderr: "pipe",
      stdout: "pipe",
    },
    {
      command: "cd ../api && pnpm build && pnpm run start",
      url: "http://localhost:3000/api/healthcheck",
      timeout: 120 * 1000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        LMS_DATABASE_URL: TEST_LMS_DATABASE_URL,
        REDIS_URL: "redis://localhost:6380",
        MODE: "test",
        E2E: "true",
        DISABLE_RATE_LIMITING: "true",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
        CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
      },
      stderr: "pipe",
      stdout: "pipe",
    },
    {
      command: "cd ../web && pnpm build && caddy run --config Caddyfile.e2e",
      url: "http://localhost:5173/",
      timeout: 120 * 1000,
      reuseExistingServer: false,
      env: {
        API_URL: "http://localhost:3000/api",
        MODE: "test",
      },
      stderr: "pipe",
      stdout: "pipe",
    },
  ];
}

export default defineConfig(config);
