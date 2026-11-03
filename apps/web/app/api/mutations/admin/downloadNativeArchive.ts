import { ApiClient } from "~/api/api-client";
import { triggerBrowserDownloadFromUrl } from "~/utils/downloadFile";

/** Downloads a finished export straight from storage, so large packages show browser progress. */
export async function downloadNativeArchive(jobId: string): Promise<void> {
  const response = await ApiClient.api.nativeArchiveControllerGetNativeArchiveDownloadUrl(jobId);

  triggerBrowserDownloadFromUrl(response.data.data.url);
}
