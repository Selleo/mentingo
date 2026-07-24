import { MICROSOFT_CALENDAR_CONNECTION_STATUSES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const MICROSOFT_CALENDAR_CONNECTION_QUERY_KEY = ["microsoft-calendar-connection"];

export const microsoftCalendarConnectionQueryOptions = queryOptions({
  queryKey: MICROSOFT_CALENDAR_CONNECTION_QUERY_KEY,
  queryFn: async () => {
    const response = await ApiClient.api.microsoftCalendarControllerGetConnection();
    return response.data.data;
  },
  refetchInterval: (query) =>
    query.state.data?.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING ? 3_000 : false,
});

export function useMicrosoftCalendarConnection() {
  return useQuery(microsoftCalendarConnectionQueryOptions);
}
