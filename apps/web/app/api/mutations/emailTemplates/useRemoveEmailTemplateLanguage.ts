import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { SupportedLanguages } from "@repo/shared";

export function useRemoveEmailTemplateLanguage() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.languageRemoved", true);

  return useMutation({
    mutationFn: async ({ id, language }: { id: string; language: SupportedLanguages }) =>
      (
        await ApiClient.api.emailTemplateManagementControllerRemoveEmailTemplateLanguage(
          id,
          language,
        )
      ).data.data,
    ...feedback,
  });
}
