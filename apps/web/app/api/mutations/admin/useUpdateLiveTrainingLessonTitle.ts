import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type UpdateLiveTrainingLessonTitleOptions = {
  lessonId: string;
  title: string;
  language: SupportedLanguages;
};

export function useUpdateLiveTrainingLessonTitle() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ lessonId, title, language }: UpdateLiveTrainingLessonTitleOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateLesson(
        { title, language },
        { id: lessonId },
      );

      return response.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({ includeCoursesAndLessons: true });

      toast({
        description: t("adminCourseView.curriculum.lesson.toast.liveTrainingLessonUpdated"),
      });
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCourseView.curriculum.lesson.toast.unexpectedError"),
        ),
      });
    },
  });
}
