import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { HELPDESK_QUERY_KEY, useHelpdeskScope } from "./self-onboarding.keys";

import type { HelpdeskSearchRequest } from "~/modules/SelfOnboarding/self-onboarding.types";

/** Forward only public search context. Version and enabled features are resolved by Core. */
export const helpdeskSearchQueryOptions = (input: HelpdeskSearchRequest, scope = "") => ({
  queryKey: [HELPDESK_QUERY_KEY, scope, "search", input],
  queryFn: async ({ signal }: QueryFunctionContext) =>
    (await ApiClient.api.searchHelpdesk(input, { signal })).data.data,
  staleTime: 30_000,
  retry: false,
});

export function useHelpdeskSearch(input: HelpdeskSearchRequest, enabled = true) {
  const scope = useHelpdeskScope();
  return useQuery({ ...helpdeskSearchQueryOptions(input, scope), enabled });
}
