import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function useDuplicateEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.copied", true);

  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.emailTemplateControllerDuplicateEmailTemplate(id)).data.data,
    ...feedback,
  });
}
