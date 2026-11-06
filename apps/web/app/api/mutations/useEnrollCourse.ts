import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { AVAILABLE_COURSES_QUERY_KEY } from "~/api/queries/useAvailableCourses";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { STUDENT_COURSES_QUERY_KEY } from "~/api/queries/useStudentCourses";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

type EnrollCourseOptions = {
  id: string;
};

export function useEnrollCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: EnrollCourseOptions) => {
      const response = await ApiClient.api.courseControllerEnrollCourse({
        id: options.id,
      });

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["course"] }),
        queryClient.invalidateQueries({ queryKey: ["lesson"] }),
        queryClient.invalidateQueries({ queryKey: [AVAILABLE_COURSES_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [STUDENT_COURSES_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY }),
      ]);
      toast({
        variant: "default",
        description: t("studentCoursesView.other.successfullyEnrolledToCourse"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
