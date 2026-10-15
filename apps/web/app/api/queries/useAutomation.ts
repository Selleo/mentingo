import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationResponse } from "./automations.response";

export function useAutomation(automationId: string) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.detail(automationId), language],
    enabled: Boolean(automationId),
    queryFn: async () => {
      const response = await ApiClient.api.automationManagementControllerGetAutomation(
        automationId,
        {
          language,
        },
      );

      return mapAutomationResponse(response.data.data);
    },
  });
}
