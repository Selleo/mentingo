import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { NATIVE_ARCHIVE_KIND } from "./nativeArchive.constants";

import type { NativeArchiveExportRequest } from "./nativeArchive.types";

export function useNativeArchiveExport() {
  return useMutation({
    mutationFn: async ({ kind, id }: NativeArchiveExportRequest) => {
      const response =
        kind === NATIVE_ARCHIVE_KIND.COURSE
          ? await ApiClient.api.nativeArchiveControllerExportNativeCourse(id)
          : await ApiClient.api.nativeArchiveControllerExportNativeLearningPath(id);
      return response.data.data.jobId;
    },
  });
}
