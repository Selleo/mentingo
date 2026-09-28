import type { NATIVE_ARCHIVE_KIND } from "./nativeArchive.constants";

export type NativeArchiveExportRequest = {
  kind: (typeof NATIVE_ARCHIVE_KIND)[keyof typeof NATIVE_ARCHIVE_KIND];
  id: string;
};
