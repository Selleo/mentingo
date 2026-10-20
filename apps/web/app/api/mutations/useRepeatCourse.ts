import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { STUDENT_COURSES_QUERY_KEY } from "~/api/queries/useStudentCourses";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useRepeatCourse(courseId: string) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (currentStateId: string) => {
      const response = await ApiClient.api.courseControllerRepeatCourse(courseId, {
        currentStateId,
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ["lesson"] });
      queryClient.removeQueries({ queryKey: ["lesson"] });
      queryClient.removeQueries({ queryKey: ["lessonProgress"] });
      queryClient.removeQueries({ queryKey: ["lessons"] });
      queryClient.removeQueries({ queryKey: ["scorm", "launch"] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["course"] }),
        queryClient.invalidateQueries({ queryKey: [STUDENT_COURSES_QUERY_KEY] }),
      ]);
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      }),
  });
}
