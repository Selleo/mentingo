import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ResourceLibraryAssetType, SupportedLanguages } from "@repo/shared";
import type { GetAssetsResponse } from "~/api/generated-api";

export type ResourceLibraryAsset = GetAssetsResponse["data"][number];

export type ResourceLibraryAssetsParams = {
  page?: number;
  perPage?: number;
  search?: string;
  type?: ResourceLibraryAssetType;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const RESOURCE_LIBRARY_ASSETS_QUERY_KEY = ["resource-library-assets"] as const;

export const resourceLibraryAssetsQueryOptions = (
  params?: ResourceLibraryAssetsParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...RESOURCE_LIBRARY_ASSETS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await ApiClient.api.resourceLibraryControllerGetAssets(params);
      return response.data;
    },
    ...options,
  });

export function useResourceLibraryAssets(
  params?: ResourceLibraryAssetsParams,
  options?: QueryOptions,
) {
  return useQuery(resourceLibraryAssetsQueryOptions(params, options));
}
