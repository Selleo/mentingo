import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { AutomationLogRecord } from "~/modules/Admin/Automation/Logs/automationLogs.types";

export const AUTOMATION_LOGS_QUERY_KEY = "automationLogs";

export function useAutomationLogs() {
  return useQuery({
    queryKey: [AUTOMATION_LOGS_QUERY_KEY],
    queryFn: async (): Promise<AutomationLogRecord[]> => {
      const response = await ApiClient.api.automationLogsControllerGetAll();
      return response.data.data as AutomationLogRecord[];
    },
  });
}

export function useAutomationLogsByAutomationId(automationId: string | undefined) {
  return useQuery({
    queryKey: [AUTOMATION_LOGS_QUERY_KEY, { automationId }],
    queryFn: async (): Promise<AutomationLogRecord[]> => {
      const response = await ApiClient.api.automationLogsControllerGetByAutomationId(automationId!);
      return response.data.data as AutomationLogRecord[];
    },
    enabled: !!automationId,
  });
}
