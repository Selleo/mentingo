import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type DeleteLessonOptions = {
  chapterId: string;
  lessonId: string;
};

export function useDeleteLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: DeleteLessonOptions) => {
      const response = await ApiClient.api.lessonControllerRemoveLesson({
        lessonId: options.lessonId,
      });

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });

      toast({ description: t("adminCourseView.toast.courseUpdatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
