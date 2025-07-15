import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";

export const useJudgeLesson = () => {
  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      const response = await ApiClient.api.aiControllerJudgeThread(threadId);
      return response.data;
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
