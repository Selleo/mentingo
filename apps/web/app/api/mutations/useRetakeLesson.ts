import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getCourseQueryKey } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { toast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export const useRetakeLesson = (lessonId: string, courseId: string) => {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      lessonId,
      learningStateId,
    }: { lessonId: string } & CourseLearningIdentity) => {
      const response = await ApiClient.api.aiControllerRetakeLesson(
        lessonId,
        courseLearningHeaders(learningStateId),
      );
      return response.data;
    },
    onError: async (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({
        description: t(message),
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await queryClient.invalidateQueries({
        queryKey: ["threadMessages", { lessonId }],
      });
      await queryClient.invalidateQueries({ queryKey: getCourseQueryKey(courseId) });
    },
  });
};
