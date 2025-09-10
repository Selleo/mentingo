import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { announcementsForUserOptions } from "../queries/useAnnouncementsForUser";
import { latestUnreadAnnouncementsOptions } from "../queries/useLatestUnreadNotifications";
import { queryClient } from "../queryClient";

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
      queryClient.invalidateQueries(announcementsForUserOptions());
      queryClient.invalidateQueries(latestUnreadAnnouncementsOptions());
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: t(error.message),
      });
    },
  });
}
