import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { UpdateEmailTemplateBaseLanguageVariables } from "~/modules/Admin/EmailTemplates/emailTemplates.types";
export function useUpdateEmailTemplateBaseLanguage() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.saved", true);

  return useMutation({
    mutationFn: async ({ id, body }: UpdateEmailTemplateBaseLanguageVariables) => {
      await ApiClient.api.emailTemplateControllerUpdateBaseLanguage(id, body);
      return (await ApiClient.api.emailTemplateControllerGetEmailTemplate(id)).data.data;
    },
    ...feedback,
  });
}
