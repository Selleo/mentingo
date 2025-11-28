import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { courseStatisticsQueryOptions } from "~/api/queries/admin/useCourseStatistics";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { invalidateAllStatisticsQueries } from "~/modules/Courses/CourseView/CourseAdminStatistics/CourseAdminStatistics";

import { ApiClient } from "../api-client";

import type { AxiosError } from "axios";

type UnenrollCourseOptions = {
  courseId: string;
  userIds: string[];
};

export function useUnenrollCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UnenrollCourseOptions) => {
      const { courseId, userIds } = options;

      const response = await ApiClient.api.courseControllerUnenrollCourses({
        courseId,
        userIds,
      });

      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });

      return response.data;
    },
    onSuccess: async (_, variables) => {
      toast({
        variant: "default",
        description: t("enrollCourseView.toast.unenrollCourseSuccessfully"),
      });

      await queryClient.invalidateQueries(courseStatisticsQueryOptions({ id: variables.courseId }));
      await invalidateAllStatisticsQueries(variables.courseId);
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
