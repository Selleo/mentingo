import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ALL_ANNOUNCEMENTS_QUERY_KEY } from "~/api/queries/admin/useAllAnnouncements";
import { ANNOUNCEMENTS_FOR_USER_QUERY_KEY } from "~/api/queries/useAnnouncementsForUser";
import { UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY } from "~/api/queries/useUnreadAnnouncementsCount";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
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
      queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_FOR_USER_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALL_ANNOUNCEMENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY] });

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
