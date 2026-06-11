import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import { invalidateCourseGenerationSyncQueries } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationSync.utils";

type SyncGeneratedCourseOptions = {
  integrationId: string;
};

export function useSyncGeneratedCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: SyncGeneratedCourseOptions) => {
      const response = await ApiClient.api.lumaControllerSyncGeneratedCourse({
        integrationId: options.integrationId,
      });

      return response.data;
    },
    onSuccess: async (_data, options) => {
      await invalidateCourseGenerationSyncQueries(options.integrationId);
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          "adminCourseView.generation.syncFailedDescription",
        ),
        variant: "destructive",
      });
    },
  });
}
