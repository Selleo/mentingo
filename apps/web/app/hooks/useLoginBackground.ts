import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";

import type i18n from "i18n";

export const loginBackgroundQueryOptions = (t: typeof i18n.t) => ({
  queryKey: ["login-background"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.settingsControllerGetLoginBackground();

      return response.data.data.url;
    } catch (error) {
      toast({ description: t("loginBackground.toast.loginBackgroundFetchError") });

      return null;
    }
  },
});

export function useLoginBackground() {
  const { t } = useTranslation();

  return useQuery(loginBackgroundQueryOptions(t));
}
