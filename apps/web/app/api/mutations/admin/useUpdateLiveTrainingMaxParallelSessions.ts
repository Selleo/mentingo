import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateLiveTrainingMaxParallelSessionsBody } from "~/api/generated-api";

export function useUpdateLiveTrainingMaxParallelSessions() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: UpdateLiveTrainingMaxParallelSessionsBody) => {
      const response =
        await ApiClient.api.settingsControllerUpdateLiveTrainingMaxParallelSessions(body);

      return response.data;
    },
    onSuccess: async () => {
      toast({
        description: t("adminPreferences.toast.liveTrainingMaxParallelSessionsChangeSuccess"),
      });

      await queryClient.invalidateQueries(globalSettingsQueryOptions);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
