import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { DASHBOARD_LAYOUT_QUERY_KEY } from "~/api/queries/useDashboardLayout";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

import type { ReplaceLayoutBody } from "~/api/generated-api";

export function useUpdateDashboardLayout() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (widgets: ReplaceLayoutBody["widgets"]) => {
      const response = await ApiClient.api.dashboardControllerReplaceLayout({
        widgets,
      });

      return response.data.data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [DASHBOARD_LAYOUT_QUERY_KEY],
      });

      toast({
        description: t("dashboardView.toast.layoutUpdated"),
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
