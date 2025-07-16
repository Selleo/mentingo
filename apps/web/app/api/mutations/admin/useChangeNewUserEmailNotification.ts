import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

export function useChangeNewUserEmailNotification() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const { data } = await ApiClient.api.settingsControllerUpdateAdminNewUserNotification();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({
        variant: "default",
        description: t("adminPreferences.toast.newUserNotificationsPreferenceChangeSuccess"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
