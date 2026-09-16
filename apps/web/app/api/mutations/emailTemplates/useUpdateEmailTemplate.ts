import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { UpdateEmailTemplateVariables } from "~/modules/Admin/EmailTemplates/emailTemplates.types";
export function useUpdateEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.saved", true);

  return useMutation({
    mutationFn: async ({ id, body }: UpdateEmailTemplateVariables) =>
      (await ApiClient.api.emailTemplateControllerUpdateEmailTemplate(id, body)).data.data,
    ...feedback,
  });
}
