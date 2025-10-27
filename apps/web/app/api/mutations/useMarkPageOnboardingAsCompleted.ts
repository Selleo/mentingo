import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries";
import { queryClient } from "../queryClient";

import type { OnboardingPages } from "@repo/shared";

export const useMarkPageOnboardingAsCompleted = (page: OnboardingPages) => {
  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.userControllerMarkOnboardingComplete(page);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions.queryKey });
    },
  });
};
