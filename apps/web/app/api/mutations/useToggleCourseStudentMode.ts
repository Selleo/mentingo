import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { currentUserQueryOptions, courseQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useToggleCourseStudentMode = (courseId: string, courseSlug: string) => {
  return useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      const response = await ApiClient.api.courseControllerSetCourseStudentMode(courseId, {
        enabled,
      });

      return response.data.data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<CurrentUserResponse | null>(
        currentUserQueryOptions.queryKey,
        (prev) =>
          prev
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  studentModeCourseIds: data.studentModeCourseIds,
                },
              }
            : prev,
      );

      await queryClient.invalidateQueries({ queryKey: currentUserQueryOptions.queryKey });
      await queryClient.invalidateQueries({ queryKey: courseQueryOptions(courseSlug).queryKey });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }

      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
