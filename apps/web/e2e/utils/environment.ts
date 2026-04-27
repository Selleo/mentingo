import { AxiosError } from "axios";

import { ENV_SECRET_NAMES, type EnvSecretName } from "../data/environment/handles";

import type { FixtureApiClient } from "./api-client";

export const getEnvSecretValue = async (
  apiClient: FixtureApiClient,
  name: EnvSecretName,
): Promise<string | null> => {
  try {
    const response = await apiClient.api.envControllerGetEnvKey(name);
    return response.data.data.value;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
};

export const upsertEnvSecretValue = async (
  apiClient: FixtureApiClient,
  name: EnvSecretName,
  value: string,
) => {
  await apiClient.api.envControllerBulkUpsertEnv([{ name, value }]);
};

export const getEffectiveSsoSecretValue = async (
  apiClient: FixtureApiClient,
  name: EnvSecretName,
) => {
  const storedValue = await getEnvSecretValue(apiClient, name);

  if (storedValue !== null) {
    return storedValue;
  }

  const response = await apiClient.api.envControllerGetFrontendSsoEnabled();

  if (name === ENV_SECRET_NAMES.VITE_GOOGLE_OAUTH_ENABLED) {
    return response.data.data.google ?? "false";
  }

  if (name === ENV_SECRET_NAMES.VITE_MICROSOFT_OAUTH_ENABLED) {
    return response.data.data.microsoft ?? "false";
  }

  if (name === ENV_SECRET_NAMES.VITE_SLACK_OAUTH_ENABLED) {
    return response.data.data.slack ?? "false";
  }

  return "false";
};
