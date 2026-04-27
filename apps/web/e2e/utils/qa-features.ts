import { ALLOWED_QA_SETTINGS } from "@repo/shared";

import type { FixtureApiClient } from "./api-client";

type QAFeatureState = {
  QAEnabled: boolean;
  unregisteredUserQAAccessibility: boolean;
};

const readQAFeatureState = async (apiClient: FixtureApiClient): Promise<QAFeatureState> => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return {
    QAEnabled: response.data.data.QAEnabled,
    unregisteredUserQAAccessibility: response.data.data.unregisteredUserQAAccessibility,
  };
};

const setQAEnabled = async (apiClient: FixtureApiClient, enabled: boolean) => {
  const state = await readQAFeatureState(apiClient);

  if (state.QAEnabled === enabled) return;

  await apiClient.api.settingsControllerUpdateQaSetting(ALLOWED_QA_SETTINGS.QA_ENABLED);
};

const setPublicQAAccess = async (apiClient: FixtureApiClient, enabled: boolean) => {
  const state = await readQAFeatureState(apiClient);

  if (state.unregisteredUserQAAccessibility === enabled) return;
  if (!state.QAEnabled) {
    await apiClient.api.settingsControllerUpdateQaSetting(ALLOWED_QA_SETTINGS.QA_ENABLED);
  }

  await apiClient.api.settingsControllerUpdateQaSetting(
    ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY,
  );
};

export const setQAFeatureState = async (
  apiClient: FixtureApiClient,
  desiredState: Partial<QAFeatureState>,
) => {
  if (desiredState.QAEnabled === true) {
    await setQAEnabled(apiClient, true);
  }

  if (desiredState.unregisteredUserQAAccessibility !== undefined) {
    await setPublicQAAccess(apiClient, desiredState.unregisteredUserQAAccessibility);
  }

  if (desiredState.QAEnabled === false) {
    await setQAEnabled(apiClient, false);
  }
};

export const ensureQAEnabled = async (apiClient: FixtureApiClient) => {
  await setQAFeatureState(apiClient, { QAEnabled: true });
};

export const ensureQAFeatures = async (
  apiClient: FixtureApiClient,
  desiredState: Partial<QAFeatureState>,
) => {
  const initialState = await readQAFeatureState(apiClient);

  await setQAFeatureState(apiClient, desiredState);

  return async () => {
    await setQAFeatureState(apiClient, initialState);
  };
};
