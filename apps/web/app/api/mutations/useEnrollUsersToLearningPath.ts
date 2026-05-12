import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { invalidateLearningPathEnrollmentData } from "../utils/invalidateLearningPathEnrollmentData";

import type { EnrollUsersToLearningPathBody } from "../generated-api";

export function useEnrollUsersToLearningPath() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: EnrollUsersToLearningPathBody;
    }) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerEnrollUsersToLearningPath(
          learningPathId,
          data,
        );

      return response.data;
    },
    onSuccess: async () => {
      await invalidateLearningPathEnrollmentData();
      toast({ description: t("learningPathsView.enrollment.studentsEnrolled") });
    },
  });
}
