import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { BetaUpdateLessonBody } from "../../generated-api";
import type { AxiosError } from "axios";

type UpdateTextLessonOptions = {
  data: BetaUpdateLessonBody;
  lessonId: string;
};

export function useUpdateTextLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateTextLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateLesson(
        { ...options.data },
        {
          id: options.lessonId,
        },
      );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });

      toast({
        description: t("adminCourseView.curriculum.lesson.toast.textLessonUpdatedSuccessfully"),
      });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string; count: number };
      toast({
        description: t(apiResponseData.message, { count: apiResponseData.count }),
        variant: "destructive",
      });
    },
  });
}
