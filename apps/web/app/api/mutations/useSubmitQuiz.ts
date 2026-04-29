import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { profileAchievementsQueryOptions } from "../queries/useProfileAchievements";
import { queryClient } from "../queryClient";

import { showAchievementUnlockToasts } from "./helpers/showAchievementUnlockToasts";

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
    onSuccess: async (result, variables) => {
      const gamification = (
        result.data as { gamification?: Parameters<typeof showAchievementUnlockToasts>[0] }
      )?.gamification;
      showAchievementUnlockToasts(gamification, t);
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(profileAchievementsQueryOptions(variables.language));
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
