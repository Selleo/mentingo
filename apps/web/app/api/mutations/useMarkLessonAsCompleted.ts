import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";
import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { certificatesQueryOptions } from "../queries/useCertificates";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export const useMarkLessonAsCompleted = (userId: string) => {
  return useMutation({
    mutationFn: async ({
      lessonId,
      language,
      learningStateId,
    }: {
      lessonId: string;
      language: SupportedLanguages;
    } & CourseLearningIdentity) => {
      const response = await ApiClient.api.studentLessonProgressControllerMarkLessonAsCompleted(
        {
          id: lessonId,
          language,
        },
        courseLearningHeaders(learningStateId),
      );
      return response.data;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lesson", variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ["lessonProgress", variables.lessonId] });
      queryClient.invalidateQueries(certificatesQueryOptions({ userId }));
      queryClient.invalidateQueries({ queryKey: ["certificate", userId] });
      await invalidateLearningPathProgressionData();
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
