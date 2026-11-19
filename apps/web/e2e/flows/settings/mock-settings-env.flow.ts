import type { Page } from "@playwright/test";

const fulfillData = (page: Page, url: string, data: unknown) =>
  page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });

/** Stripe keys are not configured in the test environment. */
export const mockStripeEnabledFlow = (page: Page) =>
  fulfillData(page, "**/api/env/frontend/stripe", { enabled: true });

/** A partially configured service cannot be reached through the API without breaking env setup. */
export const mockEnvConfigurationIssuesFlow = (page: Page) =>
  fulfillData(page, "**/api/env/config/setup", {
    fullyConfigured: [],
    partiallyConfigured: [{ service: "smtp", missingKeys: ["SMTP_HOST"] }],
    notConfigured: [],
    hasIssues: true,
    isWarningDismissed: false,
  });
