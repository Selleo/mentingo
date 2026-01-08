import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { GROUPS_BY_COURSE_QUERY_KEY } from "~/api/queries/admin/useGroupsByCourse";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UnenrollGroupsFromCourseBody } from "~/api/generated-api";

export function useUnenrollGroupsFromCourse(courseId = "") {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: UnenrollGroupsFromCourseBody) => {
      const { data } = await ApiClient.api.courseControllerUnenrollGroupsFromCourse(
        courseId,
        input,
      );

      return data;
    },
    onSuccess: async ({ data }) => {
      toast({
        variant: "default",
        description: t(data.message),
      });

      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_BY_COURSE_QUERY_KEY, courseId] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });

      await invalidateCourseStatisticsQueries();
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      return toast({
        variant: "destructive",
        description: t(message),
      });
    },
  });
}
