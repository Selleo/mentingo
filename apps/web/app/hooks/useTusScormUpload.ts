import { useCallback } from "react";

import { useTusUpload } from "./useTusUpload";

import type { UploadScormPackageArgs } from "./useTusScormUpload.types";

export const useTusScormUpload = () => {
  const tusUpload = useTusUpload();

  const uploadScormPackage = useCallback(
    async ({ file, session, onProgress, onUploaded, onError }: UploadScormPackageArgs) => {
      await tusUpload.uploadFile({
        file,
        session,
        fingerprintNamespace: "scorm-tus",
        uploadingToastKey: "adminScorm.upload.uploading",
        uploadedToastKey: "adminScorm.upload.uploadedProcessing",
        onProgress,
        onUploaded,
        onError,
      });
    },
    [tusUpload],
  );

  return {
    uploadScormPackage,
    isUploading: tusUpload.isUploading,
    uploadProgress: tusUpload.uploadProgress,
  };
};
