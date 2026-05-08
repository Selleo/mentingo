import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { EnrollUsersToLearningPathBody } from "../generated-api";

export function useEnrollUsersToLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: EnrollUsersToLearningPathBody;
    }) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerEnrollUsersToLearningPath(
          learningPathId,
          data,
        );

      return response.data;
    },
  });
}
