import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";

import { getLocalizedValue, stepsToNodes } from "./automation.utils";

import type { AutomationDetail, AutomationRecord, AutomationStepRaw } from "./automation.types";

const useAutomationByIdQuery = (automationId: string) => ({
  queryKey: [AUTOMATIONS_QUERY_KEY, { automationId }],
  queryFn: async (): Promise<AutomationDetail> => {
    const { data: automationRes } = await ApiClient.instance.get<{ data: AutomationRecord }>(
      `/api/automations/${automationId}`,
    );
    const record = automationRes.data;

    const { data: stepsRes } = await ApiClient.instance.get<{ data: AutomationStepRaw[] }>(
      `/api/automation-steps/automation/${automationId}`,
    );
    const nodes = stepsToNodes(stepsRes.data);

    return {
      id: record.id,
      name: getLocalizedValue(record.name),
      description: getLocalizedValue(record.description),
      status: record.status,
      nodes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },
  enabled: !!automationId && automationId !== "new",
});

export function useAutomationById(automationId: string) {
  return useQuery(useAutomationByIdQuery(automationId));
}

export function useAutomationByIdSuspense(automationId: string) {
  return useSuspenseQuery(useAutomationByIdQuery(automationId));
}
