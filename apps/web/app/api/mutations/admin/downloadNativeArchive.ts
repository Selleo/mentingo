import { ApiClient } from "~/api/api-client";
import {
  extractFilenameFromContentDisposition,
  triggerBrowserDownload,
} from "~/utils/downloadFile";

import { NATIVE_ARCHIVE_DEFAULT_FILENAME } from "./nativeArchive.constants";

import type { AxiosResponse } from "axios";

export async function downloadNativeArchive(jobId: string): Promise<void> {
  const response = (await ApiClient.api.nativeArchiveControllerDownloadNativeArchive(jobId, {
    format: "blob",
  })) as unknown as AxiosResponse<Blob>;
  const filename =
    extractFilenameFromContentDisposition(response.headers["content-disposition"]) ||
    NATIVE_ARCHIVE_DEFAULT_FILENAME;
  triggerBrowserDownload(response.data, filename);
}
