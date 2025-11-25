import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { BetaUpdateQuizLessonBody } from "~/api/generated-api";

type UpdateLessonOptions = {
  data: BetaUpdateQuizLessonBody;
  lessonId: string;
};

export function useUpdateQuizLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateQuizLesson(options.data, {
        id: options.lessonId,
      });

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        title: t("adminCourseView.curriculum.lesson.toast.lessonUpdatedSuccessfully"),
        description: t("adminCourseView.curriculum.lesson.toast.lessonUpdatedSuccessfully"),
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
