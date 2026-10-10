/** Lazily loads public-page metadata for one authoring source citation. */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAuthoringLinkPreviewResponse } from "../generated-api";

export type AuthoringLinkPreview = GetAuthoringLinkPreviewResponse["data"];

/** Identifies metadata for one source URL; previews are shared across sessions. */
export const authoringLinkPreviewKey = (url: string) =>
  ["course-authoring-link-preview", url] as const;

export const authoringLinkPreviewQueryOptions = (url: string, enabled: boolean) =>
  queryOptions({
    queryKey: authoringLinkPreviewKey(url),
    queryFn: async (): Promise<AuthoringLinkPreview> => {
      const response =
        await ApiClient.api.courseAuthoringLinkPreviewControllerGetAuthoringLinkPreview({ url });
      return response.data.data;
    },
    enabled: enabled && Boolean(url),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

/** Fetches only when enabled, so metadata loads when a citation popover opens. */
export const useCourseAuthoringLinkPreviewQuery = (url: string, enabled: boolean) =>
  useQuery(authoringLinkPreviewQueryOptions(url, enabled));
