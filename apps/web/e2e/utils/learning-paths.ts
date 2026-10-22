import type { FixtureApiClient } from "./api-client";

export const ensureLearningPathsEnabled = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
  if (response.data.data.learningPathsEnabled) return;

  await apiClient.api.settingsControllerUpdateLearningPathsEnabled();
};
