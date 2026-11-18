import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { invalidateNotificationsData } from "~/api/utils/invalidateNotificationsData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

type MarkAnnouncementAsReadOptions = {
  id: string;
};

export function useMarkAnnouncementAsRead() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: MarkAnnouncementAsReadOptions) => {
      const response = await ApiClient.api.announcementsControllerMarkAnnouncementAsRead(
        options.id,
      );

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("announcements.toast.markedAsRead") });
      void invalidateNotificationsData();
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
