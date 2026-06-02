import { useCallback } from "react";

import { useVideoUploadResumeStore } from "~/modules/common/store/useVideoUploadResumeStore";

import { normalizeTusHeaders, useTusUpload } from "./useTusUpload";

import type { TusUploadSession as BaseTusUploadSession } from "./useTusUpload.types";
import type { VideoProviderType } from "@repo/shared";
import type { InitVideoUploadResponse } from "~/api/generated-api";

type TusUploadSession = InitVideoUploadResponse & BaseTusUploadSession;

type GetSessionArgs = {
  file: File;
  init: () => Promise<TusUploadSession>;
  defaultProvider?: VideoProviderType;
};

type UploadArgs = {
  file: File;
  session: TusUploadSession;
  onUploadingStart?: () => void;
  onProgress?: (progress: number) => void;
  onUploaded?: () => void;
  onError?: (error: Error) => void;
};

export const useTusVideoUpload = () => {
  const tusUpload = useTusUpload();
  const { getUploadForFile, saveUpload, clearUpload } = useVideoUploadResumeStore();

  const getSessionForFile = useCallback(
    async ({ file, init, defaultProvider = "bunny" }: GetSessionArgs) => {
      const existingUpload = getUploadForFile(file);
      if (existingUpload) {
        return {
          ...existingUpload,
          provider: existingUpload.provider ?? defaultProvider,
        } as TusUploadSession;
      }

      return init();
    },
    [getUploadForFile],
  );

  const uploadVideo = useCallback(
    async ({ file, session, onUploadingStart, onProgress, onUploaded, onError }: UploadArgs) => {
      await tusUpload.uploadFile({
        file,
        session,
        fingerprintNamespace: `${session.provider}-tus`,
        resumeAdapter: {
          getUploadForFile: (uploadFile) => {
            const upload = getUploadForFile(uploadFile);
            return upload
              ? ({
                  ...upload,
                  tusHeaders: normalizeTusHeaders(upload.tusHeaders),
                } as typeof upload & TusUploadSession)
              : null;
          },
          saveUpload: (upload) =>
            saveUpload({
              uploadId: session.uploadId,
              bunnyGuid: session.bunnyGuid,
              fileKey: session.fileKey,
              provider: session.provider,
              tusEndpoint: session.tusEndpoint!,
              tusHeaders: normalizeTusHeaders(session.tusHeaders ?? {}),
              expiresAt: session.expiresAt!,
              filename: upload.filename,
              sizeBytes: upload.sizeBytes,
              lastModified: upload.lastModified,
              resourceId: session.resourceId,
            }),
          clearUpload,
        },
        uploadingToastKey: "uploadFile.toast.videoUploading",
        uploadedToastKey: "uploadFile.toast.videoUploadedProcessing",
        onUploadingStart,
        onProgress,
        onUploaded,
        onError,
      });
    },
    [clearUpload, getUploadForFile, saveUpload, tusUpload],
  );

  return {
    getSessionForFile,
    uploadVideo,
    isUploading: tusUpload.isUploading,
    uploadProgress: tusUpload.uploadProgress,
  };
};
