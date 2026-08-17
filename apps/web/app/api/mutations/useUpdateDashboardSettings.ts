import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
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
      try {
        return (await ApiClient.api.settingsControllerUpdateDashboardSettings(body)).data.data;
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 409) throw error;

        const refreshedSettings = await queryClient.fetchQuery(dashboardSettingsQueryOptions);
        return (
          await ApiClient.api.settingsControllerUpdateDashboardSettings({
            ...body,
            expectedRevision: refreshedSettings.layout.revision,
          })
        ).data.data;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(dashboardSettingsQueryOptions.queryKey, data);
      toast({ description: t("dashboardHome.toast.layoutSaved") });
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: dashboardSettingsQueryOptions.queryKey });
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("dashboardHome.toast.layoutSaveError"),
        ),
      });
    },
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
    onSuccess: (data) => {
      queryClient.setQueryData(dashboardSettingsQueryOptions.queryKey, data);
      toast({ description: t("dashboardHome.toast.layoutReset") });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("dashboardHome.toast.layoutResetError"),
        ),
      }),
  });
}
