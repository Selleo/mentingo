import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const mfaSetupQueryOptions = {
  queryKey: ["mfa-setup"],
  queryFn: async () => {
    const response = await ApiClient.api.authControllerMfaSetup();

    return response.data;
  },
};

export function useSetupMFA() {
  return useQuery(mfaSetupQueryOptions);
}
