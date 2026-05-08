import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export function useCreateLearningPathLanguage() {
  return useMutation({
    mutationFn: async ({
      learningPathId,
      language,
    }: {
      learningPathId: string;
      language: SupportedLanguages;
    }) => {
      const response = await ApiClient.api.learningPathControllerCreateLanguage(learningPathId, {
        language,
      });

      return response.data;
    },
  });
}
