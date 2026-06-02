import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export type CalendarEventsParams = {
  start?: string;
  end?: string;
  language?: SupportedLanguages;
  timezone?: string;
};

type CalendarEventsQueryOptions = {
  enabled?: boolean;
};

export const CALENDAR_EVENTS_QUERY_KEY = ["calendar-events"];

export const calendarEventsQueryOptions = (
  params: CalendarEventsParams,
  options: CalendarEventsQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...CALENDAR_EVENTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await ApiClient.api.calendarControllerGetEvents({
        start: params.start,
        end: params.end,
        language: params.language ?? SUPPORTED_LANGUAGES.EN,
        timezone: params.timezone,
      });

      return response.data.data.events;
    },
    ...options,
  });

export function useCalendarEvents(
  params: CalendarEventsParams,
  options?: CalendarEventsQueryOptions,
) {
  return useQuery(calendarEventsQueryOptions(params, options));
}
