import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";

import type { AutomationRunQuery } from "@repo/shared";

export function useAutomationRuns(query: AutomationRunQuery = {}) {
  return useQuery({
    queryKey: AUTOMATIONS_QUERY_KEYS.runs(query),
    queryFn: async () =>
      (await ApiClient.api.automationRunHistoryControllerListAutomationRuns(query)).data,
  });
}
