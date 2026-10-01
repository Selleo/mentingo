import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { SendTestEmailTemplateBody } from "~/api/generated-api";
export function useSendTestEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.testQueued", false);

  return useMutation({
    mutationFn: async (body: SendTestEmailTemplateBody) =>
      (await ApiClient.api.emailTemplateControllerSendTestEmailTemplate(body)).data.data,
    ...feedback,
  });
}
