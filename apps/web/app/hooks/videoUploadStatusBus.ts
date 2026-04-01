import type { VideoUploadStatus } from "@repo/shared";

export type VideoUploadNotificationEvent = {
  uploadId: string;
  status: VideoUploadStatus;
  fileKey?: string;
  fileUrl?: string;
  error?: string;
};

type Listener = (event: VideoUploadNotificationEvent) => void;

const listeners = new Set<Listener>();

export const emitVideoUploadStatusEvent = (event: VideoUploadNotificationEvent) => {
  listeners.forEach((listener) => listener(event));
};

export const subscribeVideoUploadStatusEvent = (listener: Listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
