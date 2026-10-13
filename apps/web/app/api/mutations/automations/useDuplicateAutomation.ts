import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { mapAutomationResponse } from "~/api/queries/automations.response";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { AutomationDto } from "@repo/shared";

export function useDuplicateAutomation() {
  const language = useLanguageStore((state) => state.language);
  const automationMutationFeedback = useAutomationMutationFeedback(
    "automations.success.duplicated",
  );

  return useMutation({
    mutationFn: async (automationId: string): Promise<AutomationDto> => {
      const response = await ApiClient.api.automationManagementControllerDuplicateAutomation(
        automationId,
        {
          language,
        },
      );

      return mapAutomationResponse(response.data.data);
    },
    ...automationMutationFeedback,
  });
}
