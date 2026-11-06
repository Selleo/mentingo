import { queryOptions, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import { AUTH_QUERY_KEYS } from "./auth.keys";

export const authSessionQueryOptions = queryOptions({
  queryKey: AUTH_QUERY_KEYS.SESSION,
  queryFn: async () => {
    try {
      const response = await ApiClient.api.authControllerSession();
      return response.data.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) return null;
      throw error;
    }
  },
  staleTime: 0,
  retry: false,
});

export function useAuthSession() {
  return useQuery(authSessionQueryOptions);
}
