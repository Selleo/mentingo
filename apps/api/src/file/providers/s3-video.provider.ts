import { randomUUID } from "crypto";

import { Injectable } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { S3Service } from "src/s3/s3.service";

import type {
  VideoProviderInitPayload,
  VideoProviderInitResult,
  VideoStorageProvider,
} from "../video-storage-provider";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024;

@Injectable()
export class S3VideoProvider implements VideoStorageProvider {
  readonly type = VIDEO_PROVIDERS.S3;

  constructor(private readonly s3Service: S3Service) {}

  async isAvailable(): Promise<boolean> {
    return this.s3Service.isConfigured();
  }

  async initVideoUpload(payload: VideoProviderInitPayload): Promise<VideoProviderInitResult> {
    const { filename, mimeType, resource } = payload;
    const extension = filename.split(".").pop() || "mp4";
    const fileKey = `${resource}/${randomUUID()}.${extension}`;
    const { uploadId } = await this.s3Service.createMultipartUpload(fileKey, mimeType);

    return {
      provider: this.type,
      fileKey,
      multipartUploadId: uploadId,
      partSize: DEFAULT_PART_SIZE,
    };
  }
}
