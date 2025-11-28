import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

export function useChangeOverdueCourseNotification() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      //   const response = await ApiClient.api.settingsControllerUpdateAdminOverdueCourseNotification();
      const response = { data: true };
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(userSettingsQueryOptions);
      toast({
        variant: "default",
        description: t("adminPreferences.toast.overdueCourseNotificationsPreferenceChangeSuccess"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("adminPreferences.toast.overdueCourseNotificationsPreferenceChangeError"),
      });
    },
  });
}
