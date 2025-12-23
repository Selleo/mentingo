import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { BetaCreateLessonBody } from "~/api/generated-api";

type CreateTextBlockOptions = {
  data: BetaCreateLessonBody;
};

export function useCreateBetaTextLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateTextBlockOptions) => {
      const response = await ApiClient.api.lessonControllerBetaCreateLesson(options.data);

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });

      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.textLessonCreatedSuccessfully"),
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
