import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const companyInformationQueryOptions = queryOptions({
  queryKey: ["company-information"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetCompanyInformation();
    return response.data;
  },
  staleTime: 1000 * 60 * 5,
});

export function useCompanyInformation() {
  return useQuery(companyInformationQueryOptions);
}
