import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { GAMIFICATION_QUERY_KEY } from "~/api/queries/useUserGamificationProfile";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

type UpdateLeaderboardSettingsBody = Parameters<
  typeof ApiClient.api.settingsControllerUpdateLeaderboardSettings
>[0];

export function useUpdateLeaderboardSettings() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: UpdateLeaderboardSettingsBody) => {
      const response = await ApiClient.api.settingsControllerUpdateLeaderboardSettings(body);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);
      queryClient.invalidateQueries({ queryKey: [GAMIFICATION_QUERY_KEY] });
      toast({ description: t("gamification.leaderboard.settings.updated") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
