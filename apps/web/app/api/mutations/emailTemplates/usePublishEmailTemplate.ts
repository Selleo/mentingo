import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { getEmailTemplatePublicationConflicts } from "~/modules/Admin/EmailTemplates/emailTemplates.utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useEmailTemplateMutationFeedback } from "./useEmailTemplateMutationFeedback";

import type { PublishEmailTemplateVariables } from "~/modules/Admin/EmailTemplates/emailTemplates.types";

export function usePublishEmailTemplate() {
  const feedback = useEmailTemplateMutationFeedback("emailTemplates.ui.published", true);

  const language = useLanguageStore((state) => state.language);
  return useMutation({
    mutationFn: async ({ id, confirmedAutomationIds }: PublishEmailTemplateVariables) =>
      (
        await ApiClient.api.emailTemplateManagementControllerPublishEmailTemplate(id, {
          language,
          confirmedAutomationIds,
        })
      ).data.data,
    ...feedback,
    onError: (error) => {
      if (!getEmailTemplatePublicationConflicts(error)) feedback.onError(error);
    },
  });
}
