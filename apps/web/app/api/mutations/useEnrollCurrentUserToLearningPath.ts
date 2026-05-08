import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useEnrollCurrentUserToLearningPath() {
  return useMutation({
    mutationFn: async (learningPathId: string) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerEnrollCurrentUserToLearningPath(
          learningPathId,
        );

      return response.data;
    },
  });
}
