import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { useAutomationMutationFeedback } from "./useAutomationMutationFeedback";

import type { AutomationSimulationInput, AutomationSimulationResult } from "@repo/shared";

export function useSimulateAutomation() {
  const automationMutationFeedback = useAutomationMutationFeedback(false);

  return useMutation({
    mutationFn: async (input: AutomationSimulationInput): Promise<AutomationSimulationResult> =>
      (await ApiClient.api.automationManagementControllerSimulateAutomation(input)).data.data,
    ...automationMutationFeedback,
  });
}
