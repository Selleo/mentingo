import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { mapAutomationEventResponses } from "./automations.response";
import { EMAIL_TEMPLATES_QUERY_KEY } from "./useEmailTemplates";

export function useEmailTemplateEvents() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...EMAIL_TEMPLATES_QUERY_KEY, "events", language],
    queryFn: async () => {
      const response = await ApiClient.api.emailTemplateManagementControllerListEmailTemplateEvents(
        { language },
      );

      return mapAutomationEventResponses(response.data.data);
    },
  });
}
