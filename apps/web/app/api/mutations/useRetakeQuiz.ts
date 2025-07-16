import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

type RetakeQuizProps = {
  lessonId: string;
  handleOnSuccess: () => void;
};

export function useRetakeQuiz({ lessonId, handleOnSuccess }: RetakeQuizProps) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.lessonControllerDeleteStudentQuizAnswers({ lessonId });
      return response.data;
    },
    onSuccess: () => {
      handleOnSuccess();
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
