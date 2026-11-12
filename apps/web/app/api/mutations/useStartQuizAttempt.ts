import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { refetchLessonOnClosedQuizAttempt } from "~/api/utils/refetchLessonOnClosedQuizAttempt";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { StartQuizAttemptBody } from "../generated-api";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export function useStartQuizAttempt() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      learningStateId,
      ...body
    }: StartQuizAttemptBody & CourseLearningIdentity) => {
      const response = await ApiClient.api.lessonControllerStartQuizAttempt(
        body,
        courseLearningHeaders(learningStateId),
      );

      return response.data.data;
    },
    // in_progress: the refetched lesson carries the attempt; finalized: an expired attempt was
    // just graded, so the refetched lesson shows its result
    onSuccess: async (_, { lessonId }) => {
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
    },
    onError: async (error, { lessonId }) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
      await refetchLessonOnClosedQuizAttempt(error, lessonId);
    },
  });
}
