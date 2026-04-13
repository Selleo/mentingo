import type { VideoProviderType } from "@repo/shared";
import type { UUIDType } from "src/common";

export type VideoProviderInitPayload = {
  filename: string;
  title?: string;
  mimeType: string;
  resource: string;
  tenantId?: UUIDType;
};

export type VideoProviderInitResult = {
  provider: VideoProviderType;
  fileKey: string;
  bunnyGuid?: string;
  tusEndpoint?: string;
  tusHeaders?: Record<string, string>;
  expiresAt?: string;
  multipartUploadId?: string;
  partSize?: number;
};

export interface VideoStorageProvider {
  type: VideoProviderType;
  isAvailable(): Promise<boolean>;
  initVideoUpload(payload: VideoProviderInitPayload): Promise<VideoProviderInitResult>;
}
