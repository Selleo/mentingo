import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AllowedQASettings } from "@repo/shared";
import type { AxiosError } from "axios";

export function useChangeQASetting() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (setting: AllowedQASettings) => {
      const response = await ApiClient.api.settingsControllerUpdateQaSetting(setting);

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("settings.toast.qaSettingUpdatedSuccessfully") });

      queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
