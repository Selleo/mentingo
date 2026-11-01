import { test as setup, expect } from "@playwright/test";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { NAVIGATION_HANDLES } from "./data/navigation/handles";
import { authenticateContext } from "./fixtures/auth.actions";
import { RECORDING_ACCOUNTS, RECORDING_ORIGIN } from "./fixtures/release-film.accounts";
import { createFixtureApiClient } from "./utils/api-client";
import { markAllOnboardingComplete } from "./utils/onboarding";

setup("authenticate populated demo and verify the app renders", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: RECORDING_ORIGIN });
  const apiClient = createFixtureApiClient();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    errors.push(
      `${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
    ),
  );
  try {
    await authenticateContext(
      context,
      RECORDING_ORIGIN,
      RECORDING_ACCOUNTS[SYSTEM_ROLE_SLUGS.ADMIN],
      "password",
    );
    await apiClient.syncFromContext(context, RECORDING_ORIGIN);
    await markAllOnboardingComplete(apiClient);
    await page.goto("/");
    await expect(page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER)).toBeVisible({
      timeout: 30_000,
    });
  } catch (error) {
    console.error("Recording startup browser errors:", JSON.stringify(errors));
    throw error;
  } finally {
    apiClient.clearCookies();
    await context.close();
  }
});
