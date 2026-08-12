import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { recordToListItem } from "./automation.utils";

import type { AutomationListItem, AutomationRecord } from "./automation.types";

export const AUTOMATIONS_QUERY_KEY = "automations";

export function useAutomations() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [AUTOMATIONS_QUERY_KEY, language],
    queryFn: async (): Promise<AutomationListItem[]> => {
      const response = await ApiClient.api.automationsControllerGetAllAutomations();
      return response.data.data.map((record) =>
        recordToListItem(record as AutomationRecord, language),
      );
    },
  });
}
