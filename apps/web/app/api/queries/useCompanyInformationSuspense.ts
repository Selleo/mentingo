import { useSuspenseQuery } from "@tanstack/react-query";

import { companyInformationQueryOptions } from "./useCompanyInformation";

export function useCompanyInformationSuspense() {
  return useSuspenseQuery(companyInformationQueryOptions);
}
