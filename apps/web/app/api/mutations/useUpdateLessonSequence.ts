import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { getLessonSequenceQueryKey } from "../queries/useLessonSequence";

import type { UpdateLessonSequenceEnabledBody } from "../generated-api";

type UpdateLessonSequenceParams = {
  courseId: string;
  data: UpdateLessonSequenceEnabledBody;
};

export function useUpdateLessonSequence() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, data }: UpdateLessonSequenceParams) => {
      const response = await ApiClient.api.courseControllerUpdateLessonSequenceEnabled(
        courseId,
        data,
      );
      return response.data;
    },
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: getLessonSequenceQueryKey({ courseId }) });
      toast({
        variant: "default",
        description: t("lessons.sequenceUpdatedSuccessfully"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("lessons.sequenceUpdateFailed"),
      });
    },
  });
}
