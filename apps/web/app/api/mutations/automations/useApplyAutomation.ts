import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { mapAutomationResponse } from "~/api/queries/automations.response";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { AutomationDto } from "@repo/shared";
import type { ApplyAutomationMutationInput } from "~/modules/Admin/Automations/automations.types";

export function useApplyAutomation() {
  const language = useLanguageStore((state) => state.language);
  const automationMutationFeedback = useAutomationMutationFeedback("automations.success.applied");

  return useMutation({
    mutationFn: async ({
      id,
      definition,
    }: ApplyAutomationMutationInput): Promise<AutomationDto> => {
      const response = await ApiClient.api.automationManagementControllerApplyAutomation(
        id,
        { definition },
        {
          language,
        },
      );

      return mapAutomationResponse(response.data.data);
    },
    ...automationMutationFeedback,
  });
}
