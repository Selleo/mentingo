import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ADMIN_ACHIEVEMENTS_QUERY_KEY } from "~/api/queries/admin/useAdminAchievements";
import { GAMIFICATION_QUERY_KEY } from "~/api/queries/useUserGamificationProfile";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { CreateAchievementBody } from "../../generated-api";

type SaveAchievementOptions = {
  id?: string;
  data: CreateAchievementBody;
};

/** Creates the achievement when no id is given, otherwise replaces its definition. */
export function useSaveAchievement() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, data }: SaveAchievementOptions) => {
      if (!id) {
        const response = await ApiClient.api.achievementAdminControllerCreateAchievement(data);

        return response.data.data.id;
      }

      await ApiClient.api.achievementAdminControllerUpdateAchievement(id, data);

      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ACHIEVEMENTS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: [GAMIFICATION_QUERY_KEY] });

      toast({ description: t("gamification.admin.toast.achievementSaved") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("gamification.admin.toast.achievementNotSaved"),
        ),
        variant: "destructive",
      });
    },
  });
}
