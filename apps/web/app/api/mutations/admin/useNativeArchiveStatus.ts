import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import {
  NATIVE_ARCHIVE_JOB_STATE,
  NATIVE_ARCHIVE_QUERY_KEY,
  NATIVE_ARCHIVE_STATUS_POLL_MS,
} from "./nativeArchive.constants";

export function useNativeArchiveStatus(jobId: string | null) {
  return useQuery({
    queryKey: [NATIVE_ARCHIVE_JOB_STATE, NATIVE_ARCHIVE_QUERY_KEY, jobId],
    queryFn: async () => {
      const response = await ApiClient.api.nativeArchiveControllerGetNativeArchiveStatus(jobId!);
      return response.data.data;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === NATIVE_ARCHIVE_JOB_STATE.COMPLETED ||
        state === NATIVE_ARCHIVE_JOB_STATE.FAILED
        ? false
        : NATIVE_ARCHIVE_STATUS_POLL_MS;
    },
  });
}
