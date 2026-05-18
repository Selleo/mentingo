import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

type CalendarEventDetailsQueryOptions = {
  enabled?: boolean;
};

export const CALENDAR_EVENT_DETAILS_QUERY_KEY = ["calendar-event-details"];

export const calendarEventDetailsQueryOptions = (
  eventId: string | null,
  language?: SupportedLanguages,
  options: CalendarEventDetailsQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...CALENDAR_EVENT_DETAILS_QUERY_KEY, eventId, language],
    queryFn: async () => {
      if (!eventId) {
        throw new Error("calendar.errors.eventIdRequired");
      }

      const response = await ApiClient.api.calendarControllerGetEventDetails(eventId, {
        language: language ?? SUPPORTED_LANGUAGES.EN,
      });

      return response.data.data;
    },
    ...options,
  });

export function useCalendarEventDetails(
  eventId: string | null,
  language?: SupportedLanguages,
  options?: CalendarEventDetailsQueryOptions,
) {
  return useQuery(calendarEventDetailsQueryOptions(eventId, language, options));
}
