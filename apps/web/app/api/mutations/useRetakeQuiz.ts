import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

type RetakeQuizProps = {
  lessonId: string;
  handleOnSuccess: () => void;
};

export function useRetakeQuiz({ lessonId, handleOnSuccess }: RetakeQuizProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.lessonControllerDeleteStudentQuizAnswers({ lessonId });
      return response.data;
    },
    onSuccess: () => {
      handleOnSuccess();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
