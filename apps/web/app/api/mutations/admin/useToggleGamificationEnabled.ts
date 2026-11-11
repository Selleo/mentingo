import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useToggleGamificationEnabled() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.settingsControllerUpdateGamificationEnabled();

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("gamification.admin.toast.settingsSaved") });

      queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
