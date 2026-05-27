import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ALL_ANNOUNCEMENTS_QUERY_KEY } from "~/api/queries/admin/useAllAnnouncements";
import { ANNOUNCEMENTS_FOR_USER_QUERY_KEY } from "~/api/queries/useAnnouncementsForUser";
import { UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY } from "~/api/queries/useUnreadAnnouncementsCount";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
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
      queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_FOR_USER_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALL_ANNOUNCEMENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY] });

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
