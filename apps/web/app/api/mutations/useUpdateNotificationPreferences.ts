import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateNotificationPreferencesBody } from "~/api/generated-api";

export function useUpdateNotificationPreferences() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (preferences: UpdateNotificationPreferencesBody) => {
      const response =
        await ApiClient.api.settingsControllerUpdateNotificationPreferences(preferences);

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(userSettingsQueryOptions);
      toast({ description: t("discussionNotifications.preferences.toast.saved") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("discussionNotifications.preferences.toast.error"),
        ),
      });
    },
  });
}
