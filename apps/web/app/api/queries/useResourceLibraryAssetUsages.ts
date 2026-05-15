import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";
import type { GetAssetUsagesResponse } from "~/api/generated-api";

export type ResourceLibraryAssetUsage = GetAssetUsagesResponse["data"][number];

type ResourceLibraryAssetUsagesParams = {
  id?: string | null;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const RESOURCE_LIBRARY_ASSET_USAGES_QUERY_KEY = ["resource-library-asset-usages"] as const;

export const resourceLibraryAssetUsagesQueryOptions = (
  params: ResourceLibraryAssetUsagesParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...RESOURCE_LIBRARY_ASSET_USAGES_QUERY_KEY, params],
    queryFn: async () => {
      if (!params.id) throw new Error("Missing asset id");

      const response = await ApiClient.api.resourceLibraryControllerGetAssetUsages(params.id, {
        language: params.language,
      });
      return response.data;
    },
    enabled: Boolean(params.id) && options.enabled !== false,
  });

export function useResourceLibraryAssetUsages(
  params: ResourceLibraryAssetUsagesParams,
  options?: QueryOptions,
) {
  return useQuery(resourceLibraryAssetUsagesQueryOptions(params, options));
}
