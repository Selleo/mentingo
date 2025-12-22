import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatisticsFilterOptions";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { GROUPS_BY_COURSE_QUERY_KEY } from "~/api/queries/admin/useGroupsByCourse";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { EnrollGroupsToCourseBody } from "~/api/generated-api";

export function useBulkGroupCourseEnroll(courseId = "") {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: EnrollGroupsToCourseBody) => {
      const { data } = await ApiClient.api.courseControllerEnrollGroupsToCourse(courseId, input);

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
      await queryClient.invalidateQueries({
        queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY],
      });
    },

    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
