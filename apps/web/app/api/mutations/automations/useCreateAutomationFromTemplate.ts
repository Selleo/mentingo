import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { mapAutomationResponse } from "~/api/queries/automations.response";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { BuiltInEmailTemplateKey } from "@repo/shared";

export function useCreateAutomationFromTemplate() {
  const language = useLanguageStore((state) => state.language);
  const automationMutationFeedback = useAutomationMutationFeedback(true);

  return useMutation({
    mutationFn: async (key: BuiltInEmailTemplateKey) => {
      const response =
        await ApiClient.api.automationManagementControllerCreateAutomationFromTemplate(key, {
          language,
        });

      return mapAutomationResponse(response.data.data);
    },
    ...automationMutationFeedback,
  });
}
