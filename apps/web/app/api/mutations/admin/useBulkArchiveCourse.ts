import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_VIEW_QUERY_KEY } from "~/api/queries/useCourse";
import { GLOBAL_SEARCH_QUERY_KEY } from "~/api/queries/useGlobalSearch";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseListData } from "~/api/utils/invalidateCourseListData";
import { useToast } from "~/components/ui/use-toast";

import type { BulkArchiveCourseBody } from "~/api/generated-api";

export function useBulkArchiveCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: BulkArchiveCourseBody) => {
      const response = await ApiClient.api.courseControllerBulkArchiveCourse(data);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateCourseListData();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: COURSE_VIEW_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: GLOBAL_SEARCH_QUERY_KEY }),
        queryClient.invalidateQueries(globalSettingsQueryOptions),
      ]);
      toast({ description: t("adminCoursesView.toast.bulkArchiveUpdateSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCoursesView.toast.bulkArchiveUpdateFailed"),
        ),
        variant: "destructive",
      });
    },
  });
}
