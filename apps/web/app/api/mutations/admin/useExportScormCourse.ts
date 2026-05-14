import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import {
  extractFilenameFromContentDisposition,
  triggerBrowserDownload,
} from "~/utils/downloadFile";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError, AxiosResponse } from "axios";

type ExportScormCoursePayload = {
  courseId: string;
  language: SupportedLanguages;
};

export function useExportScormCourse() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, language }: ExportScormCoursePayload) => {
      const response = (await ApiClient.api.courseControllerExportCourseAsScorm(
        courseId,
        { language },
        { format: "blob" },
      )) as unknown as AxiosResponse<Blob>;
      const filename =
        extractFilenameFromContentDisposition(response.headers["content-disposition"]) ||
        "course-scorm-1-2.zip";

      triggerBrowserDownload(response.data, filename);
    },
    onSuccess: () => {
      toast({ description: t("adminCourseView.scormExport.success") });
    },
    onError: (error: AxiosError) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCourseView.scormExport.error.fallback"),
        ),
        variant: "destructive",
      });
    },
  });
}
