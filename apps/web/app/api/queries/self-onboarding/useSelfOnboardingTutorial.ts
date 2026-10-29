import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { HELPDESK_QUERY_KEY, useHelpdeskScope } from "./self-onboarding.keys";

import type { SupportedLanguages } from "@repo/shared";

export const helpdeskTutorialQueryOptions = (
  key: string,
  language: SupportedLanguages,
  scope = "",
) => ({
  queryKey: [HELPDESK_QUERY_KEY, scope, "tutorial", key, language],
  queryFn: async ({ signal }: QueryFunctionContext) =>
    (await ApiClient.api.getHelpdeskTutorial(key, { language }, { signal })).data.data,
  staleTime: 30_000,
  retry: false,
});

export function useHelpdeskTutorial(key: string, language: SupportedLanguages) {
  const scope = useHelpdeskScope();
  return useQuery({ ...helpdeskTutorialQueryOptions(key, language, scope), enabled: Boolean(key) });
}
