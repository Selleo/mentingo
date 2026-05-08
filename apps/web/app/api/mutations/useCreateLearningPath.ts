import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { CreateLearningPathBody } from "../generated-api";

export function useCreateLearningPath() {
  return useMutation({
    mutationFn: async (data: CreateLearningPathBody) => {
      const response = await ApiClient.api.learningPathControllerCreateLearningPath(data);

      return response.data;
    },
  });
}
