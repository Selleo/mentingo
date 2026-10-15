import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationWorkflowTemplateResponses } from "./automations.response";

export function useAutomationWorkflowTemplates() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.workflowTemplates, language],
    queryFn: async () => {
      const response =
        await ApiClient.api.automationManagementControllerListBuiltInAutomationTemplates({
          language,
        });

      return mapAutomationWorkflowTemplateResponses(response.data.data);
    },
  });
}
