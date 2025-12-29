import { useMutation } from "@tanstack/react-query";
import { get } from "lodash-es";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { getCourseSettingsQueryKey } from "../queries/useCourseSettings.js";
import { getLessonSequenceQueryKey } from "../queries/useLessonSequence.js";

import type { UpdateCourseSettingsBody } from "../generated-api.js";

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
      const changedValues = Object.keys(data).filter(
        (key) => get(data, key) !== undefined,
      ) as (keyof UpdateCourseSettingsBody)[];
      const description = match(changedValues)
        .with(["lessonSequenceEnabled"], () => {
          queryClient.invalidateQueries({ queryKey: getLessonSequenceQueryKey({ courseId }) });
          return t("lessons.sequenceUpdatedSuccessfully");
        })
        .with(["quizFeedbackEnabled"], () => t("lessons.quizFeedbackUpdatedSuccessfully"))
        .otherwise(() => t("lessons.settingsUpdatedSuccessfully"));
      toast({
        variant: "default",
        description,
      });
    },
    onError: (_, { data }) => {
      const changedValues = Object.keys(data).filter(
        (key) => get(data, key) !== undefined,
      ) as (keyof UpdateCourseSettingsBody)[];
      const description = match(changedValues)
        .with(["lessonSequenceEnabled"], () => t("lessons.sequenceUpdateFailed"))
        .with(["quizFeedbackEnabled"], () => t("lessons.quizFeedbackUpdateFailed"))
        .otherwise(() => t("lessons.settingsUpdateFailed"));
      toast({
        variant: "destructive",
        description,
      });
    },
  });
}
