import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { EvaluationQuizBody } from "../generated-api";

type SubmitQuizProps = {
  handleOnSuccess: () => Promise<void> | void;
};

type Answer = EvaluationQuizBody;

export function useSubmitQuiz({ handleOnSuccess }: SubmitQuizProps) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (questionAnswers: Answer) => {
      const response = await ApiClient.api.lessonControllerEvaluationQuiz(questionAnswers);

      return response.data;
    },
    onSuccess: async () => {
      await handleOnSuccess();
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
