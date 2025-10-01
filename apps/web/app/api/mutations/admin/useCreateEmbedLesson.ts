import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { courseQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { CreateEmbedLessonBody } from "~/api/generated-api";

type CreateLessonOptions = {
  data: CreateEmbedLessonBody;
  courseId: string;
};

export function useCreateEmbedLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateLessonOptions) => {
      const response = await ApiClient.api.lessonControllerCreateEmbedLesson(options.data);

      return response.data;
    },
    onSuccess: (_, variables) => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.embedLessonCreatedSuccessfully"),
      });

      queryClient.invalidateQueries(courseQueryOptions(variables.courseId));
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("adminCourseView.curriculum.lesson.toast.embedLessonCreateError"),
      });
    },
  });
}
