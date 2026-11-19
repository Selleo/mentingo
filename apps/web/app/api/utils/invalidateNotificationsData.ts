import { ALL_ANNOUNCEMENTS_QUERY_KEY } from "~/api/queries/admin/useAllAnnouncements";
import { ANNOUNCEMENTS_FOR_USER_QUERY_KEY } from "~/api/queries/useAnnouncementsForUser";
import { UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY } from "~/api/queries/useUnreadAnnouncementsCount";
import { queryClient } from "~/api/queryClient";

export function invalidateNotificationsData() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_FOR_USER_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ALL_ANNOUNCEMENTS_QUERY_KEY] }),
  ]);
}
