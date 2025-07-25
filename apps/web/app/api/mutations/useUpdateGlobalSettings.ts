import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { globalSettingsQueryOptions } from "../queries/useGetGlobalSettings";
import { queryClient } from "../queryClient";

import type { UpdateGlobalSettingsBody } from "../generated-api";

type UpdateGlobalSettingsOptions = {
  data: UpdateGlobalSettingsBody;
};

export function useUpdateGlobalSettings() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateGlobalSettingsOptions) => {
      const response = await ApiClient.api.settingsControllerUpdateGlobalSettings(options.data);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);
      toast({ description: t("ssoEnforcementView.toast.ssoEnforcementUpdatedSuccessfully") });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: t("ssoEnforcementView.toast.ssoEnforcementUpdateFailed"),
        variant: "destructive",
      });
    },
  });
}
