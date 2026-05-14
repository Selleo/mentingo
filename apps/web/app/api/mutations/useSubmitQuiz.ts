import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { EvaluationQuizBody } from "../generated-api";

type SubmitQuizProps = {
  handleOnSuccess: () => Promise<void> | void;
};

type Answer = EvaluationQuizBody;

export function useSubmitQuiz({ handleOnSuccess }: SubmitQuizProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (questionAnswers: Answer) => {
      const response = await ApiClient.api.lessonControllerEvaluationQuiz(questionAnswers);

      return response.data;
    },
    onSuccess: async () => {
      await handleOnSuccess();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
