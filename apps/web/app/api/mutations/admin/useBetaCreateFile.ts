import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { BetaCreateLessonBody, BetaCreateLessonResponse } from "../../generated-api";
import type { AxiosError } from "axios";

type CreateFileOptions = {
  data: BetaCreateLessonBody;
};

type CreateLessonResult = BetaCreateLessonResponse["data"];

export function useBetaCreateFileItem() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateFileOptions): Promise<CreateLessonResult> => {
      const response = await ApiClient.api.lessonControllerBetaCreateLesson(options.data);

      return response.data.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.fileLessonCreatedSuccessfully"),
      });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string; count: number };
      toast({
        description: t(apiResponseData.message, { count: apiResponseData.count }),
        variant: "destructive",
      });
    },
  });
}
