import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AllowedNewsSettings } from "@repo/shared";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

export function useChangeNewsSetting() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (setting: AllowedNewsSettings) => {
      const response = await ApiClient.api.settingsControllerUpdateNewsSetting(setting);

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("settings.toast.newsSettingUpdatedSuccessfully") });

      queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
