import { Inject, Injectable } from "@nestjs/common";

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
  constructor(
    @Inject("CACHE_MANAGER") private readonly cache: any,
    private readonly notificationGateway: VideoUploadNotificationGateway,
  ) {}

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

    await this.cache.set(this.uploadKey(uploadId), state);
    return state;
  }

  async getState(uploadId: string): Promise<VideoUploadState | null> {
    const cached = (await this.cache.get(this.uploadKey(uploadId))) as VideoUploadState | undefined;
    return cached ?? null;
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

    await this.cache.set(this.uploadKey(params.uploadId), next);
    await this.cache.set(this.videoKey(params.bunnyVideoId), params.uploadId);

    // Publish real-time notification
    await this.notificationGateway.publishNotification({
      uploadId: params.uploadId,
      status: "uploaded",
      fileKey: params.fileKey,
      fileUrl: params.fileUrl,
    });

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

    await this.cache.set(this.uploadKey(uploadId), next);
    await this.cache.set(this.videoKey(bunnyVideoId), uploadId);

    return next;
  }

  async markFailed(uploadId: string, placeholderKey: string, error?: string) {
    const current = (await this.getState(uploadId)) ?? { uploadId, placeholderKey };
    const next: VideoUploadState = {
      ...current,
      status: "failed",
      error: error ?? "Upload failed",
    };

    await this.cache.set(this.uploadKey(uploadId), next);

    // Publish real-time notification
    await this.notificationGateway.publishNotification({
      uploadId,
      status: "failed",
      error: next.error,
    });

    return next;
  }

  async associateWithLesson(uploadId: string, lessonId: string) {
    const current = await this.getState(uploadId);
    if (!current) return null;

    const next: VideoUploadState = {
      ...current,
      lessonId,
    };

    await this.cache.set(this.uploadKey(uploadId), next);
    return next;
  }
}

