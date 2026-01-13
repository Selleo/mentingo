import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { BetaCreateLessonBody } from "~/api/generated-api";

type CreateContentOptions = {
  data: BetaCreateLessonBody;
};

export function useCreateContentLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateContentOptions) => {
      const response = await ApiClient.api.lessonControllerBetaCreateLesson(options.data);

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.contentLessonCreatedSuccessfully"),
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
