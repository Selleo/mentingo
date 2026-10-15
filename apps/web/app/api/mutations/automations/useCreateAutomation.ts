import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { mapAutomationResponse } from "~/api/queries/automations.response";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { AutomationDto, CreateAutomationInput } from "@repo/shared";

export function useCreateAutomation() {
  const language = useLanguageStore((state) => state.language);
  const automationMutationFeedback = useAutomationMutationFeedback("automations.success.created");

  return useMutation({
    mutationFn: async (input: CreateAutomationInput): Promise<AutomationDto> => {
      const response = await ApiClient.api.automationManagementControllerCreateAutomation(input, {
        language,
      });

      return mapAutomationResponse(response.data.data);
    },
    ...automationMutationFeedback,
  });
}
