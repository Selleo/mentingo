import { Inject, Injectable, Logger } from "@nestjs/common";
import { VIDEO_UPLOAD_STATUS, type VideoUploadStatus, type VideoProviderType } from "@repo/shared";
import { CacheManagerStore } from "cache-manager";

import { uploadKey, videoKey } from "src/file/utils/bunnyCacheKeys";

import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";

import type { UUIDType } from "src/common";

export type VideoUploadState = {
  uploadId: string;
  placeholderKey: string;
  status: VideoUploadStatus;
  provider?: VideoProviderType;
  fileKey?: string;
  fileUrl?: string;
  bunnyVideoId?: string;
  multipartUploadId?: string;
  partSize?: number;
  fileType?: string;
  lessonId?: string;
  error?: string;
  userId?: string;
};

@Injectable()
export class VideoProcessingStateService {
  private readonly logger = new Logger(VideoProcessingStateService.name);

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(
    @Inject("CACHE_MANAGER") private readonly cache: CacheManagerStore,
    private readonly notificationGateway: VideoUploadNotificationGateway,
  ) {}

  private readonly UPLOAD_STATE_TTL = 4 * 60 * 60 * 1000; // 4 hours for upload states
  private readonly VIDEO_MAPPING_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for video mappings

  private async retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `${operationName} failed (attempt ${attempt}/${this.MAX_RETRIES}):`,
          error,
        );

        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }

    this.logger.error(`${operationName} failed after ${this.MAX_RETRIES} attempts:`, lastError);
    throw lastError;
  }

  async initializeState(
    uploadId: string,
    placeholderKey: string,
    fileType?: string,
    userId?: UUIDType,
    options?: {
      provider?: VideoProviderType;
      fileKey?: string;
      multipartUploadId?: string;
      partSize?: number;
    },
  ) {
    const state: VideoUploadState = {
      uploadId,
      placeholderKey,
      status: VIDEO_UPLOAD_STATUS.QUEUED,
      fileType,
      userId,
      provider: options?.provider,
      fileKey: options?.fileKey,
      multipartUploadId: options?.multipartUploadId,
      partSize: options?.partSize,
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(uploadId), state, this.UPLOAD_STATE_TTL),
      `initializeState for ${uploadId}`,
    );
    return state;
  }

  async getState(uploadId: string): Promise<VideoUploadState | null> {
    try {
      const cached = (await this.retryOperation(
        () => this.cache.get(uploadKey(uploadId)),
        `getState for ${uploadId}`,
      )) as VideoUploadState | undefined;
      return cached ?? null;
    } catch (error) {
      this.logger.error(`Failed to get state for ${uploadId}:`, error);
      return null;
    }
  }

  async updateState(uploadId: string, updates: Partial<VideoUploadState>) {
    const current = await this.getState(uploadId);
    if (!current) return null;

    const next: VideoUploadState = {
      ...current,
      ...updates,
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `updateState set upload state for ${uploadId}`,
    );

    return next;
  }

  async markUploaded(params: {
    uploadId: string;
    fileKey: string;
    fileUrl: string;
    placeholderKey: string;
    fileType?: string;
    bunnyVideoId?: string;
    provider?: VideoProviderType;
  }) {
    const current: VideoUploadState = (await this.getState(params.uploadId)) ?? {
      uploadId: params.uploadId,
      placeholderKey: params.placeholderKey,
      status: VIDEO_UPLOAD_STATUS.QUEUED,
      fileType: params.fileType,
      userId: "",
    };

    const next: VideoUploadState = {
      ...current,
      status: VIDEO_UPLOAD_STATUS.UPLOADED,
      provider: params.provider ?? current.provider ?? (params.bunnyVideoId ? "bunny" : undefined),
      bunnyVideoId: params.bunnyVideoId ?? current.bunnyVideoId,
      fileKey: params.fileKey,
      fileUrl: params.fileUrl,
      fileType: params.fileType ?? current.fileType,
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(params.uploadId), next, this.UPLOAD_STATE_TTL),
      `markUploaded set upload state for ${params.uploadId}`,
    );

    const bunnyVideoId = params.bunnyVideoId ?? current.bunnyVideoId;

    if (bunnyVideoId) {
      await this.retryOperation(
        () => this.cache.set(videoKey(bunnyVideoId), params.uploadId, this.VIDEO_MAPPING_TTL),
        `markUploaded set video mapping for ${bunnyVideoId}`,
      );
    }

    try {
      await this.retryOperation(
        () =>
          this.notificationGateway.publishNotification({
            uploadId: params.uploadId,
            status: VIDEO_UPLOAD_STATUS.UPLOADED,
            fileKey: params.fileKey,
            fileUrl: params.fileUrl,
            userId: current.userId,
          }),
        `publish upload notification for ${params.uploadId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish upload notification for ${params.uploadId}:`, error);
      // Don't fail the whole operation if notification fails
    }

    return next;
  }

  async registerVideoId(params: {
    uploadId: string;
    bunnyVideoId: string;
    placeholderKey: string;
    fileKey?: string;
    provider?: VideoProviderType;
  }) {
    const current: VideoUploadState = (await this.getState(params.uploadId)) ?? {
      uploadId: params.uploadId,
      placeholderKey: params.placeholderKey,
      status: VIDEO_UPLOAD_STATUS.QUEUED,
      userId: "",
    };

    const next: VideoUploadState = {
      ...current,
      bunnyVideoId: params.bunnyVideoId,
      fileKey: params.fileKey ?? current.fileKey,
      provider: params.provider ?? current.provider ?? "bunny",
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(params.uploadId), next, this.UPLOAD_STATE_TTL),
      `registerVideoId set upload state for ${params.uploadId}`,
    );

    await this.retryOperation(
      () => this.cache.set(videoKey(params.bunnyVideoId), params.uploadId, this.VIDEO_MAPPING_TTL),
      `registerVideoId set video mapping for ${params.bunnyVideoId}`,
    );

    return next;
  }

  async markProcessed(bunnyVideoId: string, fileUrl?: string) {
    const uploadId = (await this.cache.get(videoKey(bunnyVideoId))) as string | undefined;
    if (!uploadId) return null;

    const current: VideoUploadState = (await this.getState(uploadId)) ?? {
      uploadId,
      placeholderKey: "",
      status: VIDEO_UPLOAD_STATUS.UPLOADED,
      fileKey: `bunny-${bunnyVideoId}`,
      fileUrl,
      userId: "",
    };

    const next: VideoUploadState = {
      ...current,
      status: VIDEO_UPLOAD_STATUS.PROCESSED,
      provider: current.provider ?? "bunny",
      bunnyVideoId,
      fileKey: current.fileKey ?? `bunny-${bunnyVideoId}`,
      fileUrl: fileUrl ?? current.fileUrl,
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `markProcessed set upload state for ${uploadId}`,
    );

    await this.retryOperation(
      () => this.cache.set(videoKey(bunnyVideoId), uploadId, this.VIDEO_MAPPING_TTL),
      `markProcessed set video mapping for ${bunnyVideoId}`,
    );

    return next;
  }

  async markFailed(uploadId: string, placeholderKey: string, error?: string) {
    const current = (await this.getState(uploadId)) ?? { uploadId, placeholderKey, userId: "" };
    const next: VideoUploadState = {
      ...current,
      status: VIDEO_UPLOAD_STATUS.FAILED,
      error: error ?? "Upload failed",
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `markFailed set upload state for ${uploadId}`,
    );

    try {
      await this.retryOperation(
        () =>
          this.notificationGateway.publishNotification({
            uploadId,
            status: VIDEO_UPLOAD_STATUS.FAILED,
            error: next.error,
            userId: current.userId,
          }),
        `publish failed notification for ${uploadId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish failed notification for ${uploadId}:`, error);
      // Don't fail the whole operation if notification fails
    }

    return next;
  }

  async associateWithLesson(uploadId: string, lessonId: string) {
    const current = await this.getState(uploadId);
    if (!current) return null;

    const next: VideoUploadState = {
      ...current,
      lessonId,
    };

    await this.retryOperation(
      () => this.cache.set(uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `associateWithLesson set upload state for ${uploadId}`,
    );
    return next;
  }
}
