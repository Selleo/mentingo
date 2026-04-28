import { expect } from "@playwright/test";

import type { FixtureApiClient } from "../../utils/api-client";

export const getUserQuizAttemptCountFlow = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.statisticsControllerGetUserStatistics({ language: "en" });

  return response.data.data.quizzes.totalAttempts;
};

export const waitForUserQuizAttemptCountFlow = async (
  apiClient: FixtureApiClient,
  expectedAttemptCount: number,
) => {
  await expect
    .poll(
      async () => {
        return getUserQuizAttemptCountFlow(apiClient);
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(expectedAttemptCount);
};
