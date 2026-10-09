import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationResponse } from "./automations.response";

import type { AutomationListQuery } from "@repo/shared";

export function useAutomations(query: AutomationListQuery = {}) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: AUTOMATIONS_QUERY_KEYS.list({ ...query, language }),
    queryFn: async () => {
      const response = (
        await ApiClient.api.automationManagementControllerListAutomations({ ...query, language })
      ).data;

      return { ...response, data: response.data.map(mapAutomationResponse) };
    },
  });
}
