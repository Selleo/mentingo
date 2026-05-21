import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

export function useToggleLearningPathsEnabled() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.settingsControllerUpdateLearningPathsEnabled();

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("settings.toast.learningPathsUpdatedSuccessfully") });

      queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: () => {
      toast({
        description: t("settings.toast.error.globalNotFound"),
        variant: "destructive",
      });
    },
  });
}
