import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { QUIZ_GRADING_QUERY_KEY } from "../queries/quiz-grading/useQuizGradingAnswers";
import { queryClient } from "../queryClient";

import type { GradeAnswerBody } from "../generated-api";

export function useGradeQuizAnswer() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ answerId, body }: { answerId: string; body: GradeAnswerBody }) =>
      (await ApiClient.api.quizGradingControllerGradeAnswer(answerId, body)).data.data,
    onSuccess: async ({ attemptGraded }) => {
      await queryClient.invalidateQueries({ queryKey: QUIZ_GRADING_QUERY_KEY });
      toast({
        description: attemptGraded
          ? t("quizGrading.toast.attemptGraded")
          : t("quizGrading.toast.answerGraded"),
      });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("quizGrading.toast.gradeError")),
      }),
  });
}
