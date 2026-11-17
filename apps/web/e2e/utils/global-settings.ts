import type { FixtureApiClient } from "./api-client";

export const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};
