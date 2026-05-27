import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { ANNOUNCEMENTS_FOR_USER_QUERY_KEY } from "../queries/useAnnouncementsForUser";
import { UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY } from "../queries/useUnreadAnnouncementsCount";
import { queryClient } from "../queryClient";
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
      queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_FOR_USER_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY] });
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
