import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { authService } from "~/modules/Auth/authService";

import { ApiClient } from "../api-client";
import { API_ERROR_MESSAGE_KEYS, hasApiErrorMessage } from "../utils/apiErrorResponses";

import type { CurrentUserResponse } from "../generated-api";

const isUnauthenticatedError = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 401;

const isSessionUserMissingError = (error: unknown) =>
  isAxiosError(error) && hasApiErrorMessage(error, 404, API_ERROR_MESSAGE_KEYS.USER_NOT_FOUND);

export const currentUserQueryOptions = queryOptions({
  queryKey: ["currentUser"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.authControllerCurrentUser();

      return response.data;
    } catch (error) {
      if (isUnauthenticatedError(error)) return null;

      if (isSessionUserMissingError(error)) {
        await authService.logoutFromServer();

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
