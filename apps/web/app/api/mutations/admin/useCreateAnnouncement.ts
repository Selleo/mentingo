import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateNotificationsData } from "~/api/utils/invalidateNotificationsData";
import { useToast } from "~/components/ui/use-toast";

import type { CreateAnnouncementBody } from "~/api/generated-api";

type CreateAnnouncementOptions = {
  data: CreateAnnouncementBody;
};

export function useCreateAnnouncement() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateAnnouncementOptions) => {
      const response = await ApiClient.api.announcementsControllerCreateAnnouncement(options.data);
      return response.data;
    },
    onSuccess: () => {
      void invalidateNotificationsData();

      toast({
        variant: "default",
        description: t("announcements.toast.createdSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("announcements.toast.createFailed")),
      });
    },
  });
}
