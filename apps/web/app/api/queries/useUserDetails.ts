import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUserDetailsResponse } from "../generated-api";

export const userDetails = (userId?: string, canView?: boolean) => {
  return {
    enabled: !!userId && canView,
    queryKey: ["user-details", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("userId is required");
      }
      if (!canView) {
        throw new Error("canView is required");
      }

      const response = await ApiClient.api.userControllerGetUserDetails({ userId });

      return response.data;
    },
    select: (data: GetUserDetailsResponse) => data.data,
  };
};

export function useUserDetails(userId?: string, canView?: boolean) {
  return useQuery(userDetails(userId, canView));
}

export function useUserDetailsSuspense(userId?: string, canView?: boolean) {
  return useSuspenseQuery(userDetails(userId, canView));
}
