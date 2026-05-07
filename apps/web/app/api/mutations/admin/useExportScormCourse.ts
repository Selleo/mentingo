import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";
import {
  extractFilenameFromContentDisposition,
  triggerBrowserDownload,
} from "~/utils/downloadFile";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError, AxiosResponse } from "axios";
import type { ApiErrorResponse } from "~/api/types";

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
      const payload = error.response?.data as ApiErrorResponse | undefined;
      const message = payload?.message ?? "adminCourseView.scormExport.error.fallback";

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
