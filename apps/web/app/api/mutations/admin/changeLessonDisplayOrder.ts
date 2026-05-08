import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type ChangeLessonDisplayOrderOptions = {
  lesson: { lessonId: string; displayOrder: number };
};

export function useChangeLessonDisplayOrder() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: ChangeLessonDisplayOrderOptions) => {
      const response = await ApiClient.api.lessonControllerUpdateLessonDisplayOrder(options.lesson);

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t(
          "adminCourseView.curriculum.lesson.toast.lessonDisplayOrderUpdatedSuccessfully",
        ),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("adminCourseView.curriculum.lesson.toast.errorWhileUpdating"),
          ),
          variant: "destructive",
        });
      }
      toast({
        description: error.message || t("adminCourseView.curriculum.lesson.toast.unexpectedError"),
        variant: "destructive",
      });
    },
  });
}
