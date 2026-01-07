import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_STUDENTS_PROGRESS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsProgress";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { BetaUpdateLessonBody } from "../../generated-api";
import type { AxiosError } from "axios";

type UpdateTextLessonOptions = {
  data: BetaUpdateLessonBody;
  lessonId: string;
};

export function useUpdateLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateTextLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateLesson(options.data, {
        id: options.lessonId,
      });

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t("adminCourseView.curriculum.lesson.toast.lessonUpdatedSuccessfully"),
      });

      queryClient.invalidateQueries({ queryKey: COURSE_STUDENTS_PROGRESS_QUERY_KEY });
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
