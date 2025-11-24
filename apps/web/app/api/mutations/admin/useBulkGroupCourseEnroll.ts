import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { GROUPS_BY_COURSE_QUERY_KEY } from "~/api/queries/admin/useGroupsByCourse";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { EnrollGroupsToCourseBody } from "~/api/generated-api";

export function useBulkGroupCourseEnroll(courseId = "") {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: EnrollGroupsToCourseBody) => {
      const { data } = await ApiClient.api.courseControllerEnrollGroupsToCourse(courseId, input);

      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [GROUPS_BY_COURSE_QUERY_KEY, courseId] });

      return data;
    },

    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: data.message,
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
