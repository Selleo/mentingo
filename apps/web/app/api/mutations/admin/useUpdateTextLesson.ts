import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { BetaUpdateLessonBody } from "../../generated-api";

type UpdateTextLessonOptions = {
  data: BetaUpdateLessonBody;
  lessonId: string;
};

export function useUpdateTextLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateTextLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateLesson(
        { ...options.data },
        {
          id: options.lessonId,
        },
      );

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t("adminCourseView.curriculum.lesson.toast.textLessonUpdatedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
