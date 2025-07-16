import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { courseQueryOptions } from "../queries";
import { certificatesQueryOptions } from "../queries/useCertificates";

export const useMarkLessonAsCompleted = (userId: string, courseId: string) => {
  return useMutation({
    mutationFn: async ({ lessonId }: { lessonId: string }) => {
      const response = await ApiClient.api.studentLessonProgressControllerMarkLessonAsCompleted({
        id: lessonId,
      });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(certificatesQueryOptions({ userId }));
      await queryClient.invalidateQueries(courseQueryOptions(courseId));
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
