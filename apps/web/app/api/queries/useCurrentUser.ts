import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import type { CurrentUserResponse } from "../generated-api";

export const currentUserQueryOptions = queryOptions({
  queryKey: ["currentUser"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.authControllerCurrentUser();

      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        return null;
      }
      throw error;
    }
  },
  staleTime: 1000 * 60 * 5,
});

export function useCurrentUser() {
  return useQuery({
    ...currentUserQueryOptions,
    select: (data: CurrentUserResponse | null) => data?.data,
  });
}

export function useCurrentUserSuspense() {
  return useSuspenseQuery({
    ...currentUserQueryOptions,
    select: (data: CurrentUserResponse | null) => {
      if (!data) {
        throw new Error("User not authenticated");
      }

      return data.data;
    },
  });
}
