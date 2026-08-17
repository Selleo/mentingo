import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import {
  dashboardSettingsQueryOptions,
  type DashboardLayoutSetting,
} from "../queries/useDashboardSettings";

export function useUpdateDashboardSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: { expectedRevision: number; widgets: DashboardLayoutSetting[] }) => {
      return (await ApiClient.api.settingsControllerUpdateDashboardSettings(body)).data.data;
    },
    onSuccess: (data) => queryClient.setQueryData(dashboardSettingsQueryOptions.queryKey, data),
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      }),
  });
}

export function useResetDashboardSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (expectedRevision: number) => {
      return (await ApiClient.api.settingsControllerResetDashboardSettings({ expectedRevision }))
        .data.data;
    },
    onSuccess: (data) => queryClient.setQueryData(dashboardSettingsQueryOptions.queryKey, data),
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      }),
  });
}
