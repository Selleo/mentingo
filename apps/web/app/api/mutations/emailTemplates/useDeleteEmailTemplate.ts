import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function useDeleteEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.deleted");

  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.emailTemplateControllerDeleteEmailTemplate(id)).data.data,
    ...feedback,
  });
}
