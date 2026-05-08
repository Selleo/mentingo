import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useDeleteLearningPath() {
  return useMutation({
    mutationFn: async (learningPathId: string) => {
      const response = await ApiClient.api.learningPathControllerDeleteLearningPath(learningPathId);

      return response.data;
    },
  });
}
