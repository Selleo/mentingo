import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseListData } from "~/api/utils/invalidateCourseListData";
import { useToast } from "~/components/ui/use-toast";

import type { BulkUpdateCourseStatusBody } from "~/api/generated-api";

export function useBulkUpdateCourseStatus() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: BulkUpdateCourseStatusBody) => {
      const response = await ApiClient.api.courseControllerBulkUpdateCourseStatus(data);

      return response.data;
    },
    onSuccess: async (data) => {
      await invalidateCourseListData();

      toast({ description: t(data.data.message) });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCoursesView.toast.bulkStatusUpdateFailed"),
        ),
        variant: "destructive",
      });
    },
  });
}
