import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationTemplateResponses } from "./automations.response";

export function useAutomationTemplates() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.templates, language],
    queryFn: async () => {
      const response =
        await ApiClient.api.automationManagementControllerListAvailableEmailTemplates({ language });

      return mapAutomationTemplateResponses(response.data.data);
    },
  });
}
