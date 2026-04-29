import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateGamificationPointDefaultsBody } from "~/api/generated-api";

export function useUpdateGamificationPointDefaults() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateGamificationPointDefaultsBody) => {
      const response = await ApiClient.api.settingsControllerUpdateGamificationPointDefaults(data);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);

      toast({
        description: t("gamificationPointDefaults.toast.updateSuccess"),
      });
    },
    onError: () => {
      toast({
        description: t("gamificationPointDefaults.toast.updateError"),
        variant: "destructive",
      });
    },
  });
}
