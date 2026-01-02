import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_STUDENTS_PROGRESS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsProgress";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { BetaUpdateAiMentorLessonBody } from "~/api/generated-api";

type BetaAiMentorLessonOptions = {
  data: BetaUpdateAiMentorLessonBody;
  lessonId: string;
};

export function useUpdateAiMentorLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: BetaAiMentorLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaUpdateAiMentorLesson(options.data, {
        id: options.lessonId,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.aiMentorLessonUpdatedSuccessfully"),
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
