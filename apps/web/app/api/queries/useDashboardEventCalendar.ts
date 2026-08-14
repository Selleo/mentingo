import { DASHBOARD_CALENDAR_VIEWS } from "@repo/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { DashboardCalendarView, SupportedLanguages } from "@repo/shared";

type DashboardEventCalendarParams = {
  start: string;
  end: string;
  language: SupportedLanguages;
  timezone?: string;
  view: DashboardCalendarView;
  selectedDate?: string;
};

export const dashboardEventCalendarQueryOptions = (params: DashboardEventCalendarParams) => ({
  queryKey: ["calendar/dashboard/events", params],
  queryFn: async () => {
    const response = await ApiClient.api.calendarControllerGetDashboardEvents(params);

    return response.data.data;
  },
  placeholderData: params.view === DASHBOARD_CALENDAR_VIEWS.UPCOMING ? keepPreviousData : undefined,
  staleTime: 1000 * 60,
});

export function useDashboardEventCalendar(params: DashboardEventCalendarParams) {
  return useQuery(dashboardEventCalendarQueryOptions(params));
}
