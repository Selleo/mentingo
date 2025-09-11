import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { certificatesQueryOptions } from "../queries/useCertificates";

export const useMarkLessonAsCompleted = (userId: string) => {
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
      queryClient.invalidateQueries(certificatesQueryOptions({ userId }));
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
