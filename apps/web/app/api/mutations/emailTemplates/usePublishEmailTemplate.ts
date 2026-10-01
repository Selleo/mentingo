import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

export function usePublishEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.published", true);

  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.emailTemplateControllerPublishEmailTemplate(id)).data.data,
    ...feedback,
  });
}
