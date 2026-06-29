import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseListData } from "~/api/utils/invalidateCourseListData";
import { useToast } from "~/components/ui/use-toast";

import type { DuplicateCourseResponse } from "~/api/generated-api";

export const useDuplicateCourse = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (courseId: string): Promise<DuplicateCourseResponse> => {
      const response = await ApiClient.api.courseControllerDuplicateCourse(courseId);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCourseListData();
    },
    onError: (error) => {
      toast({
        title: getTranslatedApiErrorMessage(error, t, "adminCourseDuplication.duplicateFailed"),
        variant: "destructive",
      });
    },
  });
};
