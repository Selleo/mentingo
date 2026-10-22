import { AxiosError } from "axios";

import type { FixtureApiClient } from "./api-client";
import type { EnvSecretName } from "../data/environment/handles";

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
