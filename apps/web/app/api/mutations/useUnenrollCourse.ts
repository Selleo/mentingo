import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

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
    onSuccess: async () => {
      toast({
        variant: "default",
        description: t("enrollCourseView.toast.unenrollCourseSuccessfully"),
      });

      await invalidateCourseStatisticsQueries();
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
