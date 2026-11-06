import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { authSessionQueryOptions } from "../queries/useAuthSession";
import { queryClient } from "../queryClient";

export function useMfaChallenge() {
  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.authControllerMfaChallenge();
      return response.data.data;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(authSessionQueryOptions.queryKey, session);
    },
    retry: false,
  });
}
