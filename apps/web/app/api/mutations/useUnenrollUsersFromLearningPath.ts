import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { UnenrollUsersFromLearningPathBody } from "../generated-api";

export function useUnenrollUsersFromLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: UnenrollUsersFromLearningPathBody;
    }) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerUnenrollUsersFromLearningPath(
          learningPathId,
          data,
        );

      return response.data;
    },
  });
}
