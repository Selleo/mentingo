import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "../queries/admin/useCourseStudentsAiMentorResults";

export const useJudgeLesson = (lessonId: string, courseId: string) => {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await queryClient.invalidateQueries({
        queryKey: ["threadMessages", { lessonId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
      await queryClient.invalidateQueries({
        queryKey: COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY,
      });
    },
  });
};
