import type { FixtureApiClient } from "./api-client";

export const ensureLearningPathsEnabled = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
  if (response.data.data.learningPathsEnabled) return;

  await apiClient.api.settingsControllerUpdateLearningPathsEnabled();
};

/** Enables learning paths and returns a cleanup that restores the original setting. */
export const overrideLearningPathsEnabled = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
  const wasEnabled = response.data.data.learningPathsEnabled;
  await ensureLearningPathsEnabled(apiClient);

  return async () => {
    if (wasEnabled) return;
    await apiClient.api.settingsControllerUpdateLearningPathsEnabled();
  };
};
