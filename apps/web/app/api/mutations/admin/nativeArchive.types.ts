import type { NATIVE_ARCHIVE_KIND } from "./nativeArchive.constants";
import type { GetNativeArchiveStatusResponse } from "~/api/generated-api";

export type NativeArchiveExportRequest = {
  kind: (typeof NATIVE_ARCHIVE_KIND)[keyof typeof NATIVE_ARCHIVE_KIND];
  id: string;
};

export type NativeArchiveJobProgress = NonNullable<
  GetNativeArchiveStatusResponse["data"]["progress"]
>;

export type NativeArchiveImportRequest = {
  file: File;
  /** Called with the uploaded share of the file, in percent. */
  onUploadProgress?: (percent: number) => void;
};
