import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { AutomationLogRecord } from "~/modules/Admin/Automation/Logs/automationLogs.types";

export const AUTOMATION_LOGS_QUERY_KEY = "automationLogs";

/**
 * Fetches all automation execution logs.
 *
 * Backend endpoint: GET /api/automation-logs
 */
export function useAutomationLogs() {
  return useQuery({
    queryKey: [AUTOMATION_LOGS_QUERY_KEY],
    queryFn: async (): Promise<AutomationLogRecord[]> => {
      const { data } = await ApiClient.instance.get<{ data: AutomationLogRecord[] }>(
        "/api/automation-logs",
      );
      return data.data;
    },
  });
}

/**
 * Fetches automation execution logs for a specific automation.
 *
 * Backend endpoint: GET /api/automation-logs/automation/:automationId
 */
export function useAutomationLogsByAutomationId(automationId: string | undefined) {
  return useQuery({
    queryKey: [AUTOMATION_LOGS_QUERY_KEY, { automationId }],
    queryFn: async (): Promise<AutomationLogRecord[]> => {
      const { data } = await ApiClient.instance.get<{ data: AutomationLogRecord[] }>(
        `/api/automation-logs/automation/${automationId}`,
      );
      return data.data;
    },
    enabled: !!automationId,
  });
}
