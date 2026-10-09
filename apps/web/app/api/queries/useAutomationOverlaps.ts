import { AUTOMATION_STATUSES, AUTOMATION_STEP_TYPES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AUTOMATIONS_QUERY_KEYS } from "./automations.keys";
import { mapAutomationResponse } from "./automations.response";

import type { AutomationDto, AutomationEventKind } from "@repo/shared";
/** Every enabled page is inspected, including overlaps beyond the first hundred records. */
export function useAutomationOverlaps(
  eventKind: AutomationEventKind | null | undefined,
  automationId?: string,
) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [...AUTOMATIONS_QUERY_KEYS.overlaps(eventKind, automationId), language],
    enabled: Boolean(eventKind),
    queryFn: async () => {
      const matches: AutomationDto[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = (
          await ApiClient.api.automationManagementControllerListAutomations({
            status: AUTOMATION_STATUSES.ENABLED,
            language,
            page,
            perPage: 100,
          })
        ).data;

        totalPages = Math.ceil(response.pagination.totalItems / response.pagination.perPage);

        for (const automation of response.data.map(mapAutomationResponse)) {
          if (
            automation.id !== automationId &&
            automation.appliedDefinition?.workflow.steps.some(
              (step) =>
                step.type === AUTOMATION_STEP_TYPES.TRIGGER && step.config.eventKind === eventKind,
            )
          ) {
            matches.push(automation);
          }
        }

        page++;
      } while (page <= totalPages);

      return matches;
    },
  });
}
