import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { BetaCreateLiveTrainingLessonBody } from "~/api/generated-api";

type CreateLiveTrainingLessonOptions = {
  data: BetaCreateLiveTrainingLessonBody;
};

export function useCreateLiveTrainingLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateLiveTrainingLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaCreateLiveTrainingLesson(
        options.data,
      );

      return response.data;
    },
    onSuccess: async (data) => {
      await invalidateLiveTrainingData({ includeCoursesAndLessons: true });

      toast({ description: t(data.data.message) });
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
