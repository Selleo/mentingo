import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { BetaUpdateAiMentorLessonBody } from "~/api/generated-api";

type BetaAiMentorLessonOptions = {
  data: BetaUpdateAiMentorLessonBody;
  lessonId: string;
};

export function useUpdateAiMentorLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BetaAiMentorLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateAiMentorLesson(options.data, {
        id: options.lessonId,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.aiMentorLessonUpdatedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
