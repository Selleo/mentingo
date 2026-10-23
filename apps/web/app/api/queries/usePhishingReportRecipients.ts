import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { phishingReportQueryKey } from "./usePhishingReport";

type ReportRecipientsQuery = NonNullable<
  Parameters<typeof ApiClient.api.phishingControllerGetPhishingReportRecipients>[1]
>;

export function usePhishingReportRecipients(id: string, query: ReportRecipientsQuery) {
  return useQuery({
    queryKey: [...phishingReportQueryKey(id), "recipients", query],
    queryFn: async () =>
      (await ApiClient.api.phishingControllerGetPhishingReportRecipients(id, query)).data,
    placeholderData: keepPreviousData,
    staleTime: 10000,
  });
}
