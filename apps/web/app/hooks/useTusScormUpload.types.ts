import type { InitScormImportResponse } from "~/api/generated-api";

export type UploadScormPackageArgs = {
  file: File;
  session: InitScormImportResponse;
  onProgress?: (progress: number) => void;
  onUploaded?: () => void;
  onError?: (error: Error) => void;
};
