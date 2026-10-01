import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function useRestoreEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.restored", true);

  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.emailTemplateControllerRestoreEmailTemplate(id)).data.data,
    ...feedback,
  });
}
