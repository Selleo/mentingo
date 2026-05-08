import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { ReorderLearningPathCoursesBody } from "../generated-api";

export function useReorderLearningPathCourses() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: ReorderLearningPathCoursesBody;
    }) => {
      const response = await ApiClient.api.learningPathCourseControllerReorderLearningPathCourses(
        learningPathId,
        data,
      );

      return response.data;
    },
  });
}
