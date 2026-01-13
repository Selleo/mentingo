import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { courseQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { EmbedLessonResource } from "~/api/types";

type CreateEmbedLessonBody = {
  title: string;
  type: "embed";
  chapterId: string;
  resources: EmbedLessonResource[];
};

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
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string; count: number };

      toast({
        description: t(apiResponseData.message, { count: apiResponseData.count }),
        variant: "destructive",
      });
    },
  });
}
