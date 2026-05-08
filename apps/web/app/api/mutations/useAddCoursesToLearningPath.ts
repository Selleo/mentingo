import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { AddCoursesToLearningPathBody } from "../generated-api";

export function useAddCoursesToLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: AddCoursesToLearningPathBody;
    }) => {
      const response = await ApiClient.api.learningPathCourseControllerAddCoursesToLearningPath(
        learningPathId,
        data,
      );

      return response.data;
    },
  });
}
