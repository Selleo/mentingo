import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { invalidateNotificationsData } from "~/api/utils/invalidateNotificationsData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useMarkAllAnnouncementsAsRead() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data } = await ApiClient.api.announcementsControllerMarkAllAnnouncementsAsRead();

      return data;
    },
    onSuccess: () => {
      void invalidateNotificationsData();

      toast({ description: t("announcements.toast.markedAsRead") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("announcements.toast.markAsReadFailed"),
        ),
      });
    },
  });
}
