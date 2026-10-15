import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";

import type { AutomationRecipientOptionsQuery } from "@repo/shared";

export function useAutomationRecipientOptions({
  enabled = true,
  ...query
}: AutomationRecipientOptionsQuery & { enabled?: boolean }) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.recipientOptions(query), language],
    queryFn: async () =>
      (
        await ApiClient.api.automationManagementControllerListAutomationRecipientOptions({
          ...query,
          language,
        })
      ).data,
    enabled,
  });
}
