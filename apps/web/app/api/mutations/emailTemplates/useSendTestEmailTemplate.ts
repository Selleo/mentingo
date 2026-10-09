import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { EnqueueEmailTemplateTestBody } from "~/api/generated-api";
export function useSendTestEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.testQueued", false);

  return useMutation({
    mutationFn: async (body: EnqueueEmailTemplateTestBody) =>
      (await ApiClient.api.emailTemplateManagementControllerEnqueueEmailTemplateTest(body)).data
        .data,
    ...feedback,
  });
}
