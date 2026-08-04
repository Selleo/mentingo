import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { recordToListItem } from "./automation.utils";

import type { AutomationListItem, AutomationRecord } from "./automation.types";

export const AUTOMATIONS_QUERY_KEY = "automations";

export function useAutomations() {
  return useQuery({
    queryKey: [AUTOMATIONS_QUERY_KEY],
    queryFn: async (): Promise<AutomationListItem[]> => {
      const { data } = await ApiClient.instance.get<{ data: AutomationRecord[] }>(
        "/api/automations",
      );
      return data.data.map((record) => recordToListItem(record));
    },
  });
}
