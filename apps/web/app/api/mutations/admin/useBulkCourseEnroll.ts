import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { GROUPS_BY_COURSE_QUERY_KEY } from "~/api/queries/admin/useGroupsByCourse";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { invalidateCourseStatisticsQueries } from "~/api/utils/courseStatisticsUtils";
import { useToast } from "~/components/ui/use-toast";

import type { EnrollCoursesBody } from "~/api/generated-api";

export function useBulkCourseEnroll(courseId = "") {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: EnrollCoursesBody) => {
      const { data } = await ApiClient.api.courseControllerEnrollCourses(courseId, input);

      return data;
    },

    onSuccess: async ({ data }) => {
      toast({
        variant: "default",
        description: data.message,
      });

      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_BY_COURSE_QUERY_KEY, courseId] });

      await invalidateCourseStatisticsQueries();
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
