import type { FixtureApiClient } from "./api-client";

export const getUserLanguage = async (apiClient: FixtureApiClient) =>
  (await apiClient.api.settingsControllerGetUserSettings()).data.data?.language;
