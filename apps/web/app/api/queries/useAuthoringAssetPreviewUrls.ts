/** Load protected authoring asset blobs and expose temporary URLs for read-only lesson previews. */
import { useQueries } from "@tanstack/react-query";
import { isAxiosError, isCancel } from "axios";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiClient } from "~/api/api-client";
import { getAuthoringAssetIds } from "~/modules/CourseAuthoring/review/authoringAssetPreview";

type AuthoringAssetPreviewOptions = {
  courseId: string;
  sessionId: string | null | undefined;
  html: string;
  readyAssetIds: readonly string[];
};

type ObjectUrlEntry = {
  cacheKey: string;
  assetId: string;
  blob: Blob;
  url: string;
};

/** Fetch only referenced ready assets through Core's course-authorized preview endpoint. */
export const useAuthoringAssetPreviewUrls = ({
  courseId,
  sessionId,
  html,
  readyAssetIds,
}: AuthoringAssetPreviewOptions) => {
  const referencedAssetIds = useMemo(() => getAuthoringAssetIds(html), [html]);
  const requestedAssetIds = useMemo(() => {
    const readyIds = new Set(readyAssetIds);
    if (!courseId || !sessionId) return [];
    return referencedAssetIds.filter((assetId) => readyIds.has(assetId));
  }, [courseId, referencedAssetIds, readyAssetIds, sessionId]);

  const queries = useQueries({
    queries: requestedAssetIds.map((assetId) => ({
      queryKey: ["course-authoring", courseId, sessionId, "asset-preview", assetId, 1],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        if (!sessionId) throw new Error("authoring_asset_preview_session_required");
        const response = await ApiClient.api.courseAuthoringControllerPreviewAuthoringAsset(
          courseId,
          sessionId,
          assetId,
          { revision: 1 },
          { signal },
        );
        return response.data;
      },
      enabled: Boolean(courseId && sessionId),
      retry: (failureCount: number, error: unknown) => {
        if (isCancel(error) || failureCount >= 2) return false;
        if (!isAxiosError(error) || !error.response) return true;
        const status = error.response.status;
        return status >= 500 || status === 408 || status === 429;
      },
      retryDelay: 1000,
      staleTime: Infinity,
    })),
  });

  const objectUrlsRef = useRef<Map<string, ObjectUrlEntry>>(new Map());
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextEntries = new Map<string, ObjectUrlEntry>();
    const nextUrls: Record<string, string> = {};

    queries.forEach((query, index) => {
      const blob = query.data;
      const assetId = requestedAssetIds[index];
      if (!blob || !assetId || typeof URL.createObjectURL !== "function") return;

      const cacheKey = `${courseId}:${sessionId}:${assetId}:1`;
      const existing = objectUrlsRef.current.get(cacheKey);
      if (existing && existing.blob !== blob) URL.revokeObjectURL(existing.url);
      const entry: ObjectUrlEntry =
        existing?.blob === blob
          ? existing
          : { cacheKey, assetId, blob, url: URL.createObjectURL(blob) };
      nextEntries.set(cacheKey, entry);
      nextUrls[assetId] = entry.url;
    });

    for (const [cacheKey, entry] of objectUrlsRef.current) {
      if (!nextEntries.has(cacheKey)) URL.revokeObjectURL(entry.url);
    }
    objectUrlsRef.current = nextEntries;
    setUrls((current) => (sameUrls(current, nextUrls) ? current : nextUrls));
  }, [courseId, queries, requestedAssetIds, sessionId]);

  useEffect(
    () => () => {
      for (const entry of objectUrlsRef.current.values()) URL.revokeObjectURL(entry.url);
      objectUrlsRef.current.clear();
    },
    [],
  );

  const loadingAssetIds = requestedAssetIds.filter((_, index) => queries[index]?.isPending);
  const failedAssetIds = requestedAssetIds.filter(
    (_, index) => queries[index]?.isError && !queries[index]?.data,
  );
  const visibleUrls = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(urls).filter(([assetId, url]) => {
          if (!requestedAssetIds.includes(assetId) || !sessionId) return false;
          const cacheKey = `${courseId}:${sessionId}:${assetId}:1`;
          return objectUrlsRef.current.get(cacheKey)?.url === url;
        }),
      ),
    [courseId, requestedAssetIds, sessionId, urls],
  );

  const retryFailedPreviews = async () => {
    await Promise.all(
      queries.filter((query) => query.isError && !query.data).map((query) => query.refetch()),
    );
  };

  return {
    urls: visibleUrls,
    loadingAssetIds,
    failedAssetIds,
    retryFailedPreviews,
    isRetrying: queries.some((query) => query.isError && query.isFetching),
  };
};

/** Avoid render loops when the query result array changes but its resolved URLs do not. */
const sameUrls = (current: Record<string, string>, next: Record<string, string>): boolean =>
  Object.keys(current).length === Object.keys(next).length &&
  Object.entries(next).every(([assetId, url]) => current[assetId] === url);
