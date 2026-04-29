import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { courseQueryOptions } from "../queries";
import { certificatesQueryOptions } from "../queries/useCertificates";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { profileAchievementsQueryOptions } from "../queries/useProfileAchievements";

import { showAchievementUnlockToasts } from "./helpers/showAchievementUnlockToasts";

import type { SupportedLanguages } from "@repo/shared";

export const useMarkLessonAsCompleted = (userId: string, courseSlug: string) => {
  const { t } = useTranslation();

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
    onSuccess: (result, variables) => {
      const gamification = (
        result.data as { gamification?: Parameters<typeof showAchievementUnlockToasts>[0] }
      )?.gamification;
      showAchievementUnlockToasts(gamification, t);
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(profileAchievementsQueryOptions(variables.language));
      queryClient.invalidateQueries({ queryKey: ["lesson", variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ["lessonProgress", variables.lessonId] });
      queryClient.invalidateQueries(certificatesQueryOptions({ userId }));
      queryClient.invalidateQueries({ queryKey: ["certificate", userId] });
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
