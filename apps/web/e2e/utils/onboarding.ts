import { OnboardingPages } from "@repo/shared";

import type { FixtureApiClient } from "./api-client";

const E2E_COMPLETED_ONBOARDING_PAGES = Object.values(OnboardingPages);

export const markAllOnboardingComplete = async (apiClient: FixtureApiClient) => {
  for (const page of E2E_COMPLETED_ONBOARDING_PAGES) {
    await apiClient.api.userControllerMarkOnboardingComplete(page);
  }
};
