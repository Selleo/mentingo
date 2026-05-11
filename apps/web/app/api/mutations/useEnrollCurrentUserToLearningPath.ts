import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { LEARNING_PATHS_QUERY_KEY } from "../queries/useLearningPaths";
import { queryClient } from "../queryClient";

export function useEnrollCurrentUserToLearningPath() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (learningPathId: string) => {
      const response =
        await ApiClient.api.learningPathEnrollmentControllerEnrollCurrentUserToLearningPath(
          learningPathId,
        );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY });
      toast({ description: t("learningPathsView.enrollment.enrolledSuccessfully") });
    },
  });
}
