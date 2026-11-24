import { CALENDAR_CONNECTION_STATUSES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const GOOGLE_CALENDAR_CONNECTION_QUERY_KEY = ["google-calendar-connection"];

export const googleCalendarConnectionQueryOptions = queryOptions({
  queryKey: GOOGLE_CALENDAR_CONNECTION_QUERY_KEY,
  queryFn: async () => {
    const response = await ApiClient.api.googleCalendarControllerGetGoogleCalendarConnection();
    return response.data.data;
  },
  refetchInterval: (query) =>
    query.state.data?.status === CALENDAR_CONNECTION_STATUSES.SYNCING ? 3_000 : false,
});

export function useGoogleCalendarConnection(enabled = true) {
  return useQuery({ ...googleCalendarConnectionQueryOptions, enabled });
}
