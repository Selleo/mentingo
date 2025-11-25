import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { courseQueryOptions, lessonQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateEmbedLessonBody } from "../../generated-api";
import type { AxiosError } from "axios";

type UpdateEmbedLessonOptions = {
  data: UpdateEmbedLessonBody;
  lessonId: string;
  courseId: string;
};

export function useUpdateEmbedLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateEmbedLessonOptions) => {
      const response = await ApiClient.api.lessonControllerUpdateEmbedLesson(
        options.lessonId,
        options.data,
      );

      return response.data;
    },
    onSuccess: (_, variables) => {
      toast({
        description: t("adminCourseView.curriculum.lesson.toast.embedLessonUpdatedSuccessfully"),
      });

      queryClient.invalidateQueries(courseQueryOptions(variables.courseId));
      queryClient.invalidateQueries(lessonQueryOptions(variables.lessonId));
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
