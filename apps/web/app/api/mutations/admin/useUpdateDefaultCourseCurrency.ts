import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateDefaultCourseCurrencyBody } from "~/api/generated-api";

export function useUpdateDefaultCourseCurrency() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateDefaultCourseCurrencyBody) => {
      const response = await ApiClient.api.settingsControllerUpdateDefaultCourseCurrency(data);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);

      toast({
        description: t("defaultCourseCurrencyView.toast.defaultCourseCurrencyChangeSuccess"),
      });
    },
    onError: () => {
      toast({
        description: t("defaultCourseCurrencyView.toast.defaultCourseCurrencyChangeError"),
        variant: "destructive",
      });
    },
  });
}
