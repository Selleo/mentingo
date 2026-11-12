import { queryOptions, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "~/api/api-client";

const isSecretNotSet = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

export const secretQueryOptions = (secretName: string, viewSecret: boolean) =>
  queryOptions({
    enabled: viewSecret,
    queryKey: ["secrets", { secretName }],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.envControllerGetEnvKey(secretName);
        return response.data;
      } catch (error) {
        if (isSecretNotSet(error)) return { data: { name: secretName, value: "" } };
        throw error;
      }
    },
  });

export function useSecret(secretName: string, viewSecret: boolean) {
  return useQuery(secretQueryOptions(secretName, viewSecret));
}
