import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateNotificationsData } from "~/api/utils/invalidateNotificationsData";
import { useToast } from "~/components/ui/use-toast";

type DeleteAnnouncementOptions = {
  id: string;
};

export function useDeleteAnnouncement() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id }: DeleteAnnouncementOptions) => {
      const { data } = await ApiClient.api.announcementsControllerDeleteAnnouncement(id);

      return data;
    },
    onSuccess: () => {
      void invalidateNotificationsData();

      toast({ description: t("announcements.toast.deletedSuccessfully") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("announcements.toast.deleteFailed")),
      });
    },
  });
}
