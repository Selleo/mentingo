import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { mapAutomationResponse } from "~/api/queries/automations.response";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { AutomationDto } from "@repo/shared";
import type { UpdateAutomationMutationInput } from "~/modules/Admin/Automations/automations.types";

export function useUpdateAutomation() {
  const language = useLanguageStore((state) => state.language);
  const automationMutationFeedback = useAutomationMutationFeedback(
    "automations.success.draftSaved",
  );

  return useMutation({
    mutationFn: async (input: UpdateAutomationMutationInput): Promise<AutomationDto> => {
      const response = await ApiClient.api.automationManagementControllerUpdateAutomation(
        input.id,
        input.data,
        { language },
      );

      return mapAutomationResponse(response.data.data);
    },
    ...automationMutationFeedback,
  });
}
