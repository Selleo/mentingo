import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function useArchiveEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.archived", true);

  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.emailTemplateControllerArchiveEmailTemplate(id)).data.data,
    ...feedback,
  });
}
