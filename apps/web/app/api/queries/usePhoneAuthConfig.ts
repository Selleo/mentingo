import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const phoneAuthConfigQueryOptions = queryOptions({
  queryKey: ["phoneAuthConfig"],
  queryFn: async () => {
    const response = await ApiClient.api.phoneAuthControllerGetPhoneAuthConfig();

    return response.data.data;
  },
});

export function usePhoneAuthConfig() {
  return useQuery(phoneAuthConfigQueryOptions);
}

export function useIsPhoneAuthEnabled() {
  const { data } = usePhoneAuthConfig();

  return data?.enabled ?? false;
}
