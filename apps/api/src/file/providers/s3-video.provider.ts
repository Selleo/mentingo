import { randomUUID } from "crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import { DEFAULT_TUS_CHUNK_SIZE, DEFAULT_TUS_TTL_MS, VIDEO_PROVIDERS } from "@repo/shared";

import { S3Service } from "src/s3/s3.service";

import { prefixTenantStorageKey } from "../utils/tenantStorageKey";

import type {
  VideoProviderInitPayload,
  VideoProviderInitResult,
  VideoStorageProvider,
} from "../video-storage-provider";

@Injectable()
export class S3VideoProvider implements VideoStorageProvider {
  readonly type = VIDEO_PROVIDERS.S3;

  constructor(private readonly s3Service: S3Service) {}

  async isAvailable(): Promise<boolean> {
    return this.s3Service.isConfigured();
  }

  async initVideoUpload(payload: VideoProviderInitPayload): Promise<VideoProviderInitResult> {
    const { filename, mimeType, resource, tenantId } = payload;

    if (!tenantId) throw new BadRequestException("files.toast.missingTenantContext");

    const extension = filename.split(".").pop() || "mp4";
    const fileKey = prefixTenantStorageKey(`${resource}/${randomUUID()}.${extension}`, tenantId);
    const { uploadId } = await this.s3Service.createMultipartUpload(fileKey, mimeType);
    const expiresAt = new Date(Date.now() + DEFAULT_TUS_TTL_MS).toISOString();

    return {
      provider: this.type,
      fileKey,
      multipartUploadId: uploadId,
      partSize: DEFAULT_TUS_CHUNK_SIZE,
      tusEndpoint: "/api/file/videos/tus",
      tusHeaders: {},
      expiresAt,
    };
  }
}
