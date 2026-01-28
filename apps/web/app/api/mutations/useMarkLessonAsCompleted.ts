import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { courseQueryOptions } from "../queries";
import { certificatesQueryOptions } from "../queries/useCertificates";

import type { SupportedLanguages } from "@repo/shared";

export const useMarkLessonAsCompleted = (userId: string, courseSlug: string) => {
  return useMutation({
    mutationFn: async ({
      lessonId,
      language,
    }: {
      lessonId: string;
      language: SupportedLanguages;
    }) => {
      const response = await ApiClient.api.studentLessonProgressControllerMarkLessonAsCompleted({
        id: lessonId,
        language,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lesson", variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ["lessonProgress", variables.lessonId] });
      queryClient.invalidateQueries(certificatesQueryOptions({ userId }));
      queryClient.invalidateQueries(courseQueryOptions(courseSlug));
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
