import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { CreateEmailTemplateBody } from "~/api/generated-api";
export function useCreateEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.saved");
  return useMutation({
    mutationFn: async (body: CreateEmailTemplateBody) =>
      (await ApiClient.api.emailTemplateManagementControllerCreateEmailTemplate(body)).data.data,
    ...feedback,
  });
}
