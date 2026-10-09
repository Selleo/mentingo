import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

export function useDeleteAutomation() {
  const automationMutationFeedback = useAutomationMutationFeedback("automations.success.deleted");

  return useMutation({
    mutationFn: async (automationId: string): Promise<void> => {
      await ApiClient.api.automationManagementControllerDeleteAutomation(automationId);
    },
    ...automationMutationFeedback,
  });
}
