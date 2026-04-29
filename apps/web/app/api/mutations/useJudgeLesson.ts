import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "../queries/admin/useCourseStudentsAiMentorResults";
import { getCurrentThreadMessagesQueryKey } from "../queries/useCurrentThreadMessages";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { profileAchievementsQueryOptions } from "../queries/useProfileAchievements";

import { showAchievementUnlockToasts } from "./helpers/showAchievementUnlockToasts";

export const useJudgeLesson = (lessonId: string, courseId: string) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();

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
    onSuccess: async (result, { threadId }) => {
      const gamification = (
        result.data as { gamification?: Parameters<typeof showAchievementUnlockToasts>[0] }
      )?.gamification;
      showAchievementUnlockToasts(gamification, t);
      await queryClient.invalidateQueries(currentUserQueryOptions);
      await queryClient.invalidateQueries(profileAchievementsQueryOptions(language));
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await queryClient.invalidateQueries({
        queryKey: getCurrentThreadMessagesQueryKey(threadId),
      });

      await queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
      await queryClient.invalidateQueries({
        queryKey: COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY,
      });
    },
  });
};
