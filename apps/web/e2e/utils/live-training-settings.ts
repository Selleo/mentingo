import type { FixtureApiClient } from "./api-client";

const isLiveTrainingEnabled = async (apiClient: FixtureApiClient) =>
  (await apiClient.api.settingsControllerGetPublicGlobalSettings()).data.data.liveTrainingEnabled;

/** Enables live training in the current tenant; returns a task that restores the original value. */
export const enableLiveTraining = async (apiClient: FixtureApiClient) => {
  const originalValue = await isLiveTrainingEnabled(apiClient);

  if (!originalValue) await apiClient.api.settingsControllerUpdateLiveTrainingEnabled();

  return async () => {
    if ((await isLiveTrainingEnabled(apiClient)) !== originalValue) {
      await apiClient.api.settingsControllerUpdateLiveTrainingEnabled();
    }
  };
};
