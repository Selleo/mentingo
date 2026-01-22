import { DEFAULT_TUS_CHUNK_SIZE, type VideoProviderType } from "@repo/shared";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import * as tus from "tus-js-client";

import { useToast } from "~/components/ui/use-toast";
import { useVideoUploadResumeStore } from "~/modules/common/store/useVideoUploadResumeStore";

import type { InitVideoUploadResponse } from "~/api/generated-api";

type TusUploadSession = InitVideoUploadResponse;

type GetSessionArgs = {
  file: File;
  init: () => Promise<TusUploadSession>;
  defaultProvider?: VideoProviderType;
};

type UploadArgs = {
  file: File;
  session: TusUploadSession;
};

const normalizeTusHeaders = (headers: object): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));

const buildFileFingerprint = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export const useTusVideoUpload = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getUploadForFile, saveUpload, clearUpload } = useVideoUploadResumeStore();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
    async ({ file, session }: UploadArgs) => {
      if (!session.tusEndpoint || !session.tusHeaders || !session.expiresAt) {
        throw new Error("Missing upload configuration");
      }

      const existingUpload = getUploadForFile(file);
      const tusHeaders = normalizeTusHeaders(session.tusHeaders ?? {});
      const tusFingerprint = `${session.provider}-tus:${session.uploadId}:${buildFileFingerprint(
        file,
      )}`;

      if (!existingUpload) {
        saveUpload({
          uploadId: session.uploadId,
          bunnyGuid: session.bunnyGuid,
          fileKey: session.fileKey,
          provider: session.provider,
          tusEndpoint: session.tusEndpoint,
          tusHeaders,
          expiresAt: session.expiresAt,
          filename: file.name,
          sizeBytes: file.size,
          lastModified: file.lastModified,
          resourceId: session.resourceId,
        });
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        await new Promise<void>((resolve, reject) => {
          toast({
            description: t("uploadFile.toast.videoUploading"),
            duration: Number.POSITIVE_INFINITY,
            variant: "loading",
          });

          const upload = new tus.Upload(file, {
            endpoint: session.tusEndpoint,
            headers: tusHeaders,
            chunkSize: session.partSize ?? DEFAULT_TUS_CHUNK_SIZE,
            metadata: {
              filename: file.name,
              filetype: file.type,
              uploadId: session.uploadId,
            },
            retryDelays: [0, 1000, 3000, 5000, 10000],
            fingerprint: async () => tusFingerprint,
            removeFingerprintOnSuccess: true,
            onProgress: (bytesUploaded, bytesTotal) => {
              if (bytesTotal === 0) return;
              const progress = Math.round((bytesUploaded / bytesTotal) * 100);
              setUploadProgress(progress);
            },
            onError: (error) => {
              clearUpload(session.uploadId);
              reject(error);
            },
            onSuccess: () => {
              clearUpload(session.uploadId);
              toast({
                description: t("uploadFile.toast.videoUploadedProcessing"),
                duration: Number.POSITIVE_INFINITY,
                variant: "success",
              });
              resolve();
            },
          });

          upload.findPreviousUploads().then((previousUploads) => {
            if (previousUploads.length > 0) {
              upload.resumeFromPreviousUpload(previousUploads[0]);
            }
            upload.start();
          });
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [clearUpload, getUploadForFile, saveUpload, t, toast],
  );

  return {
    getSessionForFile,
    uploadVideo,
    isUploading,
    uploadProgress,
  };
};
