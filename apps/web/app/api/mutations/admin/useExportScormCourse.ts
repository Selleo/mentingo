import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type ExportScormCoursePayload = {
  courseId: string;
  language: SupportedLanguages;
};

export function useExportScormCourse() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, language }: ExportScormCoursePayload) => {
      const response = await ApiClient.api.courseControllerExportCourseAsScorm(courseId, {
        language,
      });

      return response.data.data.jobId;
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
