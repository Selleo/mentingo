import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { useCurrentUser } from "../queries/useCurrentUser";
import {
  dashboardSettingsQueryOptions,
  getDashboardSettingsQueryKey,
  type DashboardLayoutSetting,
} from "../queries/useDashboardSettings";

export function useUpdateDashboardSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  return useMutation({
    mutationFn: async (body: { expectedRevision: number; widgets: DashboardLayoutSetting[] }) => {
      try {
        return (await ApiClient.api.settingsControllerUpdateDashboardSettings(body)).data.data;
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 409) throw error;

        if (!userId) throw error;

        const refreshedSettings = await queryClient.fetchQuery(
          dashboardSettingsQueryOptions(userId),
        );
        return (
          await ApiClient.api.settingsControllerUpdateDashboardSettings({
            ...body,
            expectedRevision: refreshedSettings.layout.revision,
          })
        ).data.data;
      }
    },
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(getDashboardSettingsQueryKey(userId), data);
      toast({ description: t("dashboardHome.toast.layoutSaved") });
    },
    onError: (error) => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: getDashboardSettingsQueryKey(userId) });
      }
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
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  return useMutation({
    mutationFn: async (expectedRevision: number) => {
      return (await ApiClient.api.settingsControllerResetDashboardSettings({ expectedRevision }))
        .data.data;
    },
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(getDashboardSettingsQueryKey(userId), data);
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
