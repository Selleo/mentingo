import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";

export function useAutomationRun(automationRunId: string) {
  return useQuery({
    queryKey: AUTOMATIONS_QUERY_KEYS.run(automationRunId),
    enabled: Boolean(automationRunId),
    queryFn: async () =>
      (await ApiClient.api.automationRunHistoryControllerGetAutomationRun(automationRunId)).data
        .data,
  });
}
