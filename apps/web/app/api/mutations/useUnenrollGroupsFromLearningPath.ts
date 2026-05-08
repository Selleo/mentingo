import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { UnenrollGroupsFromLearningPathBody } from "../generated-api";

export function useUnenrollGroupsFromLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: UnenrollGroupsFromLearningPathBody;
    }) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerUnenrollGroupsFromLearningPath(
          learningPathId,
          data,
        );

      return response.data;
    },
  });
}
