import type { InitScormImportBody } from "./schemas/scormImport.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type ScormTusUploadState = {
  packageId: UUIDType;
  uploadId: UUIDType;
  stagedFileReference: string;
  multipartUploadId: string;
  uploadLength: number;
  offset: number;
  parts: Array<{ ETag: string; PartNumber: number }>;
  filename: string;
  mimeType: string;
  userId: UUIDType;
  tenantId: UUIDType;
  importRequest: InitScormImportBody;
  completed: boolean;
};

export type CreateScormTusUploadSessionParams = {
  packageId: UUIDType;
  uploadId: UUIDType;
  stagedFileReference: string;
  multipartUploadId: string;
  importRequest: InitScormImportBody;
  currentUser: CurrentUserType;
};
