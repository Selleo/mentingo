import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { currentUserQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

export const useToggleCourseStudentMode = (courseId: string) => {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      const response = await ApiClient.api.courseControllerSetCourseStudentMode(courseId, {
        enabled,
      });

      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: currentUserQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["course"], refetchType: "active" }),
      ]);
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({
        description: t(message),
        variant: "destructive",
      });
    },
  });
};
