import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";

export const useRetakeLesson = () => {
  return useMutation({
    mutationFn: async ({ lessonId }: { lessonId: string }) => {
      const response = await ApiClient.api.aiControllerRetakeLesson(lessonId);
      return response.data;
    },
    onError: async (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data?.message,
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
