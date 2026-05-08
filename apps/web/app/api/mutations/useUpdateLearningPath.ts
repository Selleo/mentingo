import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { UpdateLearningPathBody } from "../generated-api";

export function useUpdateLearningPath() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: UpdateLearningPathBody;
    }) => {
      const response = await ApiClient.api.learningPathControllerUpdateLearningPath(
        learningPathId,
        data,
      );

      return response.data;
    },
  });
}
