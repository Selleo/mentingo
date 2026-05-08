import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useRemoveCourseFromLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      courseId,
    }: {
      learningPathId: string;
      courseId: string;
    }) => {
      const response = await ApiClient.api.learningPathCourseControllerRemoveCourseFromLearningPath(
        learningPathId,
        courseId,
      );

      return response.data;
    },
  });
}
