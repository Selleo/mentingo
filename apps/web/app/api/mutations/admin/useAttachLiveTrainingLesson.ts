import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { AttachLiveTrainingLessonBody } from "~/api/generated-api";

type AttachLiveTrainingLessonOptions = {
  lessonId: string;
  data: AttachLiveTrainingLessonBody;
};

export function useAttachLiveTrainingLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ lessonId, data }: AttachLiveTrainingLessonOptions) => {
      const response = await ApiClient.api.lessonControllerAttachLiveTrainingLesson(lessonId, data);

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
