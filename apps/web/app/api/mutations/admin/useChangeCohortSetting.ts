import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AllowedCohortSettings } from "@repo/shared";
import type { AxiosError } from "axios";

export function useChangeCohortSetting() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (setting: AllowedCohortSettings) => {
      const response = await ApiClient.instance.patch(`/api/settings/admin/cohort/${setting}`);

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("settings.toast.cohortLearningSettingUpdatedSuccessfully") });

      queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
