import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { EmailTemplateEvent } from "~/modules/Admin/EmailTemplates/emailTemplates.types";
export function useCopyDefaultEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.copied", true);

  return useMutation({
    mutationFn: async (event: EmailTemplateEvent) =>
      (await ApiClient.api.emailTemplateControllerCopyDefaultEmailTemplate(event)).data.data,
    ...feedback,
  });
}
