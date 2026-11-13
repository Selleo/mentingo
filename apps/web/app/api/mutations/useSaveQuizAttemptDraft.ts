import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import {
  isClosedQuizAttemptError,
  refetchLessonOnClosedQuizAttempt,
} from "~/api/utils/refetchLessonOnClosedQuizAttempt";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { GetLessonByIdResponse, SaveQuizAttemptDraftBody } from "../generated-api";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export function useSaveQuizAttemptDraft() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      learningStateId,
      ...body
    }: SaveQuizAttemptDraftBody & CourseLearningIdentity) => {
      const response = await ApiClient.api.lessonControllerSaveQuizAttemptDraft(
        body,
        courseLearningHeaders(learningStateId),
      );

      return response.data.data;
    },
    onSuccess: ({ draftSavedAt }, { lessonId, attemptId, questionsAnswers }) => {
      // keep cached lessons in sync, so returning to the quiz without a refetch restores this draft
      queryClient
        .getQueriesData<GetLessonByIdResponse>({ queryKey: ["lesson", lessonId] })
        .forEach(([queryKey, cached]) => {
          const quizAttempt = cached?.data.quizAttempt;

          if (!cached || quizAttempt?.attemptId !== attemptId) return;

          queryClient.setQueryData<GetLessonByIdResponse>(
            queryKey,
            {
              ...cached,
              data: {
                ...cached.data,
                quizAttempt: { ...quizAttempt, draftAnswers: questionsAnswers, draftSavedAt },
              },
            },
            // keep the fetch time: the countdown pairs it with the cached serverNow
            { updatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt },
          );
        });
    },
    onError: async (error, { lessonId }) => {
      // A closed attempt means it was submitted or finalized; the refetched lesson shows the result.
      if (isClosedQuizAttemptError(error)) {
        await refetchLessonOnClosedQuizAttempt(error, lessonId);

        return;
      }

      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
