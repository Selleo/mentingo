import { Inject, Injectable, Logger } from "@nestjs/common";

import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";

type VideoUploadStatus = "queued" | "uploaded" | "processed" | "failed";

export type VideoUploadState = {
  uploadId: string;
  placeholderKey: string;
  status: VideoUploadStatus;
  fileKey?: string;
  fileUrl?: string;
  bunnyVideoId?: string;
  fileType?: string;
  lessonId?: string;
  error?: string;
};

@Injectable()
export class VideoProcessingStateService {
  private readonly logger = new Logger(VideoProcessingStateService.name);

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(
    @Inject("CACHE_MANAGER") private readonly cache: any,
    private readonly notificationGateway: VideoUploadNotificationGateway,
  ) {}

  // TTL constants in milliseconds
  private readonly UPLOAD_STATE_TTL = 4 * 60 * 60 * 1000; // 4 hours for upload states
  private readonly VIDEO_MAPPING_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for video mappings

  private async retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operationName} failed (attempt ${attempt}/${this.MAX_RETRIES}):`, error);

        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }

    this.logger.error(`${operationName} failed after ${this.MAX_RETRIES} attempts:`, lastError);
    throw lastError;
  }

  private uploadKey(uploadId: string) {
    return `video-upload:${uploadId}`;
  }

  private videoKey(videoId: string) {
    return `video-upload:video:${videoId}`;
  }

  async initializeState(uploadId: string, placeholderKey: string, fileType?: string) {
    const state: VideoUploadState = {
      uploadId,
      placeholderKey,
      status: "queued",
      fileType,
    };

    await this.retryOperation(
      () => this.cache.set(this.uploadKey(uploadId), state, this.UPLOAD_STATE_TTL),
      `initializeState for ${uploadId}`
    );
    return state;
  }

  async getState(uploadId: string): Promise<VideoUploadState | null> {
    try {
      const cached = await this.retryOperation(
        () => this.cache.get(this.uploadKey(uploadId)),
        `getState for ${uploadId}`
      ) as VideoUploadState | undefined;
      return cached ?? null;
    } catch (error) {
      this.logger.error(`Failed to get state for ${uploadId}:`, error);
      return null;
    }
  }

  async markUploaded(params: {
    uploadId: string;
    bunnyVideoId: string;
    fileKey: string;
    fileUrl: string;
    placeholderKey: string;
    fileType?: string;
  }) {
    const current = (await this.getState(params.uploadId)) ?? {
      uploadId: params.uploadId,
      placeholderKey: params.placeholderKey,
      fileType: params.fileType,
    };

    const next: VideoUploadState = {
      ...current,
      status: "uploaded",
      bunnyVideoId: params.bunnyVideoId,
      fileKey: params.fileKey,
      fileUrl: params.fileUrl,
      fileType: params.fileType ?? current.fileType,
    };

    // Use retry for critical cache operations
    await this.retryOperation(
      () => this.cache.set(this.uploadKey(params.uploadId), next, this.UPLOAD_STATE_TTL),
      `markUploaded set upload state for ${params.uploadId}`
    );

    await this.retryOperation(
      () => this.cache.set(this.videoKey(params.bunnyVideoId), params.uploadId, this.VIDEO_MAPPING_TTL),
      `markUploaded set video mapping for ${params.bunnyVideoId}`
    );

    // Publish real-time notification (also with retry)
    try {
      await this.retryOperation(
        () => this.notificationGateway.publishNotification({
          uploadId: params.uploadId,
          status: "uploaded",
          fileKey: params.fileKey,
          fileUrl: params.fileUrl,
        }),
        `publish upload notification for ${params.uploadId}`
      );
    } catch (error) {
      this.logger.error(`Failed to publish upload notification for ${params.uploadId}:`, error);
      // Don't fail the whole operation if notification fails
    }

    return next;
  }

  async markProcessed(bunnyVideoId: string, fileUrl?: string) {
    const uploadId = (await this.cache.get(this.videoKey(bunnyVideoId))) as string | undefined;
    if (!uploadId) return null;

    const current: VideoUploadState =
      (await this.getState(uploadId)) ?? {
        uploadId,
        placeholderKey: "",
        status: "uploaded",
        fileKey: `bunny-${bunnyVideoId}`,
        fileUrl,
      };

    const next: VideoUploadState = {
      ...current,
      status: "processed",
      bunnyVideoId,
      fileKey: current.fileKey ?? `bunny-${bunnyVideoId}`,
      fileUrl: fileUrl ?? current.fileUrl,
    };

    await this.retryOperation(
      () => this.cache.set(this.uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `markProcessed set upload state for ${uploadId}`
    );

    await this.retryOperation(
      () => this.cache.set(this.videoKey(bunnyVideoId), uploadId, this.VIDEO_MAPPING_TTL),
      `markProcessed set video mapping for ${bunnyVideoId}`
    );

    return next;
  }

  async markFailed(uploadId: string, placeholderKey: string, error?: string) {
    const current = (await this.getState(uploadId)) ?? { uploadId, placeholderKey };
    const next: VideoUploadState = {
      ...current,
      status: "failed",
      error: error ?? "Upload failed",
    };

    await this.retryOperation(
      () => this.cache.set(this.uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `markFailed set upload state for ${uploadId}`
    );

    // Publish real-time notification (also with retry)
    try {
      await this.retryOperation(
        () => this.notificationGateway.publishNotification({
          uploadId,
          status: "failed",
          error: next.error,
        }),
        `publish failed notification for ${uploadId}`
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
      () => this.cache.set(this.uploadKey(uploadId), next, this.UPLOAD_STATE_TTL),
      `associateWithLesson set upload state for ${uploadId}`
    );
    return next;
  }
}

