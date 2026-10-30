import { useInfiniteQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

type SearchQuery = NonNullable<
  Parameters<typeof ApiClient.api.phishingControllerSearchPhishingOptions>[0]
>;

export function useInfinitePhishingOptions(
  kind: NonNullable<SearchQuery["kind"]>,
  search: string,
  enabled: boolean,
) {
  const language = useLanguageStore((state) => state.language);
  return useInfiniteQuery({
    queryKey: ["phishing", "options", kind, language, search],
    queryFn: async ({ pageParam }) =>
      (
        await ApiClient.api.phishingControllerSearchPhishingOptions({
          kind,
          language,
          search,
          page: pageParam,
        })
      ).data.data,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.hasNextPage ? pages.length + 1 : undefined),
    enabled,
  });
}
