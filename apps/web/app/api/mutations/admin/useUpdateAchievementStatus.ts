import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ADMIN_ACHIEVEMENTS_QUERY_KEY } from "~/api/queries/admin/useAdminAchievements";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

export function useUpdateAchievementStatus() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      await ApiClient.api.achievementAdminControllerUpdateAchievementStatus(id, { isEnabled });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ACHIEVEMENTS_QUERY_KEY });

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
