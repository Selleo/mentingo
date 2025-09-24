import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";

import type i18n from "i18n";

export const platformLogoQueryOptions = (t: typeof i18n.t) => ({
  queryKey: ["platform-logo"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.settingsControllerGetPlatformLogo();

      return response.data.data.url;
    } catch (error) {
      toast({ description: t("platformLogo.toast.logoFetchError") });

      return null;
    }
  },
});

export function usePlatformLogo() {
  const { t } = useTranslation();

  return useQuery(platformLogoQueryOptions(t));
}
