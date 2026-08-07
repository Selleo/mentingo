import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { userSettingsQueryOptions } from "../queries/useUserSettings";

import type { UpdateUserSettingsBody } from "../generated-api";

export function useUpdateDashboardWidgets() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: UpdateUserSettingsBody) => {
      const response = await ApiClient.api.settingsControllerUpdateUserSettings(options);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userSettingsQueryOptions.queryKey,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
