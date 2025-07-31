import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

export const useMarkLessonAsCompleted = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lessonId }: { lessonId: string }) => {
      const response = await ApiClient.api.studentLessonProgressControllerMarkLessonAsCompleted({
        id: lessonId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lesson", variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ["lessonProgress", variables.lessonId] });
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
