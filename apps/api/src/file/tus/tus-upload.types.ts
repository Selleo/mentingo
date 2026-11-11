import type { UUIDType } from "src/common";

export type TusUploadOwner = { userId: string; tenantId: string };

export type TusUploadState = {
  uploadId: string;
  fileKey: string;
  multipartUploadId: string;
  uploadLength: number;
  offset: number;
  parts: Array<{ ETag: string; PartNumber: number }>;
  placeholderKey: string;
  fileType?: string;
  userId: string;
  tenantId: string;
  resourceId?: UUIDType;
  sniffedMimeType?: string;
};
