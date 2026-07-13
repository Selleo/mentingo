import type { FixtureApiClient } from "./api-client";

const readLearningPathsEnabled = async (apiClient: FixtureApiClient): Promise<boolean> => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data.learningPathsEnabled;
};

export const ensureLearningPathsEnabled = async (
  apiClient: FixtureApiClient,
  enabled = true,
): Promise<() => Promise<void>> => {
  const initiallyEnabled = await readLearningPathsEnabled(apiClient);

  if (initiallyEnabled !== enabled) {
    await apiClient.api.settingsControllerUpdateLearningPathsEnabled();
  }

  if (enabled) {
    return async () => {};
  }

  return async () => {
    const currentlyEnabled = await readLearningPathsEnabled(apiClient);

    if (currentlyEnabled !== initiallyEnabled) {
      await apiClient.api.settingsControllerUpdateLearningPathsEnabled();
    }
  };
};
