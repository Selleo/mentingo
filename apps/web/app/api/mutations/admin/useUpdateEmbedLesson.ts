import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { courseQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateEmbedLessonBody } from "../../generated-api";

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
        description: t("adminCourseView.curriculum.lesson.toast.lessonUpdatedSuccessfully"),
      });

      queryClient.invalidateQueries(courseQueryOptions(variables.courseId));
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
