import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UpdateAgeLimitBody } from "~/api/generated-api";

export function useChangeAgeLimit() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (ageLimit: UpdateAgeLimitBody) => {
      const response = await ApiClient.api.settingsControllerUpdateAgeLimit(ageLimit);

      return response.data;
    },
    onSuccess: async () => {
      toast({ description: t("settings.toast.ageLimitUpdatedSuccessfully") });

      await queryClient.invalidateQueries({ queryKey: globalSettingsQueryOptions.queryKey });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
