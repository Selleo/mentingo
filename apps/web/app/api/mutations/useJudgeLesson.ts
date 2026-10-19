import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";
import { toast } from "~/components/ui/use-toast";

import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "../queries/admin/useCourseStudentsAiMentorResults";
import { getCurrentThreadMessagesQueryKey } from "../queries/useCurrentThreadMessages";

import type { CourseLearningIdentity } from "~/api/utils/course-learning-state.types";

export const useJudgeLesson = (lessonId: string) => {
  return useMutation({
    mutationFn: async ({
      threadId,
      learningStateId,
    }: { threadId: string } & CourseLearningIdentity) => {
      const response = await ApiClient.api.aiControllerJudgeThread(
        threadId,
        courseLearningHeaders(learningStateId),
      );
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
    onSuccess: async (_, { threadId }) => {
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await queryClient.invalidateQueries({
        queryKey: getCurrentThreadMessagesQueryKey(threadId),
      });

      await invalidateLearningPathProgressionData();
      await queryClient.invalidateQueries({
        queryKey: COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY,
      });
    },
  });
};
