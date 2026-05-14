import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { ALL_COURSES_QUERY_KEY } from "../queries/useCourses";
import { LEARNING_PATHS_QUERY_KEY } from "../queries/useLearningPaths";
import { queryClient } from "../queryClient";

import type { AddCoursesToLearningPathBody } from "../generated-api";

export function useAddCoursesToLearningPath() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      learningPathId,
      data,
    }: {
      learningPathId: string;
      data: AddCoursesToLearningPathBody;
    }) => {
      const response = await ApiClient.api.learningPathCourseControllerAddCoursesToLearningPath(
        learningPathId,
        data,
      );

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY }),
      ]);
      toast({ description: t("adminLearningPathsView.toast.coursesAdded") });
    },
  });
}
