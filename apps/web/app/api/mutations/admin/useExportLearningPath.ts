import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY } from "~/api/queries/admin/useLearningPathExportCandidates";
import { LEARNING_PATH_EXPORTS_QUERY_KEY } from "~/api/queries/admin/useLearningPathExports";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ExportLearningPathBody, ExportLearningPathResponse } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

type ExportLearningPathPayload = {
  learningPathId: string;
  targetTenantIds: string[];
};

export function useExportLearningPath() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      learningPathId,
      targetTenantIds,
    }: ExportLearningPathPayload): Promise<ExportLearningPathResponse> => {
      const payload: ExportLearningPathBody = {
        targetTenantIds,
      };

      const response = await ApiClient.api.learningPathExportControllerExportLearningPath(
        learningPathId,
        payload,
      );
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...LEARNING_PATH_EXPORTS_QUERY_KEY, variables.learningPathId],
        }),
        queryClient.invalidateQueries({
          queryKey: [...LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY, variables.learningPathId],
        }),
      ]);
      toast({ description: t("adminLearningPathsView.sharedLearningPath.exportSuccess") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
