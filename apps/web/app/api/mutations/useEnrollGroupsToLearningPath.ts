import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { EnrollGroupsToLearningPathBody } from "../generated-api";

export function useEnrollGroupsToLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: EnrollGroupsToLearningPathBody;
    }) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerEnrollGroupsToLearningPath(
          learningPathId,
          data,
        );

      return response.data;
    },
  });
}
