import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationEventResponses } from "./automations.response";

export function useAutomationEvents() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.events, language],
    queryFn: async () => {
      const response = await ApiClient.api.automationManagementControllerListAutomationEvents({
        language,
      });

      return mapAutomationEventResponses(response.data.data);
    },
  });
}
