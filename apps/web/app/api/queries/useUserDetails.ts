import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUserDetailsResponse } from "../generated-api";

export const userDetails = (userId?: string, isAdminLike?: boolean) => {
  return {
    enabled: !!userId && isAdminLike,
    queryKey: ["user-details", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("userId is required");
      }
      if (!isAdminLike) {
        throw new Error("isAdminLike is required");
      }

      const response = await ApiClient.api.userControllerGetUserDetails({ userId });

      return response.data;
    },
    select: (data: GetUserDetailsResponse) => data.data,
  };
};

export function useUserDetails(userId?: string, isAdminLike?: boolean) {
  return useQuery(userDetails(userId, isAdminLike));
}

export function useUserDetailsSuspense(userId?: string) {
  return useSuspenseQuery(userDetails(userId));
}
