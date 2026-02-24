import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY } from "~/api/queries/admin/useMasterCourseExportCandidates";
import { MASTER_COURSE_EXPORTS_QUERY_KEY } from "~/api/queries/admin/useMasterCourseExports";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { ExportMasterCourseBody, ExportMasterCourseResponse } from "../../generated-api";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type ExportMasterCoursePayload = {
  courseId: string;
  targetTenantIds: string[];
};

export function useExportMasterCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      courseId,
      targetTenantIds,
    }: ExportMasterCoursePayload): Promise<ExportMasterCourseResponse> => {
      const payload: ExportMasterCourseBody = {
        targetTenantIds,
      };

      const response = await ApiClient.api.courseControllerExportMasterCourse(courseId, payload);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...MASTER_COURSE_EXPORTS_QUERY_KEY, variables.courseId],
        }),
        queryClient.invalidateQueries({
          queryKey: [...MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY, variables.courseId],
        }),
      ]);
      toast({ description: t("adminCourseView.toast.courseUpdatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
