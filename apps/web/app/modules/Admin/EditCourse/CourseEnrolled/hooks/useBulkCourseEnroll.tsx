import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { EnrollCoursesBody } from "~/api/generated-api";

export function useBulkCourseEnroll(courseId = "") {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: EnrollCoursesBody) => {
      const response = await ApiClient.api.courseControllerEnrollCourses(courseId, data);

      await queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] });

      return response.data;
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
