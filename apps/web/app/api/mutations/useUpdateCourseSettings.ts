import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { getLessonSequenceQueryKey } from "../queries/useLessonSequence.js";

import type { UpdateCourseSettingsBody } from "../generated-api.js";
import { getCourseSettingsQueryKey } from "../queries/useCourseSettings.js";

type UpdateCourseSettingsParams = {
  courseId: string;
  data: UpdateCourseSettingsBody;
};

export function useUpdateCourseSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, data }: UpdateCourseSettingsParams) => {
      const response = await ApiClient.api.courseControllerUpdateCourseSettings(courseId, data);
      return response.data;
    },
    onSuccess: (_, { courseId, data }) => {
      queryClient.invalidateQueries({ queryKey: getCourseSettingsQueryKey({ courseId }) });
      if ("lessonSequenceEnabled" in data) {
        queryClient.invalidateQueries({ queryKey: getLessonSequenceQueryKey({ courseId }) });
        toast({
          variant: "default",
          description: t("lessons.sequenceUpdatedSuccessfully"),
        });
      }
      if ("quizFeedbackEnabled" in data) {
        toast({
          variant: "default",
          description: t("lessons.quizFeedbackUpdatedSuccessfully"),
        });
      }
    },
    onError: (_, data) => {
      if ("lessonSequenceEnabled" in data) {
        toast({
          variant: "destructive",
          description: t("lessons.sequenceUpdateFailed"),
        });
      }
      if ("quizFeedbackEnabled" in data) {
        toast({
          variant: "destructive",
          description: t("lessons.quizFeedbackUpdateFailed"),
        });
      }
    },
  });
}
