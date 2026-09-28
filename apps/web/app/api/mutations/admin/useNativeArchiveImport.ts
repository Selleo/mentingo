import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import { useTusUpload } from "~/hooks/useTusUpload";

import { NATIVE_ARCHIVE_TUS_FINGERPRINT_NAMESPACE } from "./nativeArchive.constants";

export function useNativeArchiveImport() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const tusUpload = useTusUpload();

  return useMutation({
    mutationFn: async (file: File) => {
      const init = await ApiClient.api.nativeArchiveControllerInitTusImport({
        sizeBytes: file.size,
      });
      const session = init.data.data;
      await tusUpload.uploadFile({
        file,
        session,
        fingerprintNamespace: NATIVE_ARCHIVE_TUS_FINGERPRINT_NAMESPACE,
      });
      const response = await ApiClient.api.nativeArchiveControllerCompleteTusImport(
        session.uploadId,
      );
      return response.data.data.jobId;
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("nativeArchive.error")),
        variant: "destructive",
      });
    },
  });
}
