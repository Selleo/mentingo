import type { GetAllAnnouncementsResponse } from "~/api/generated-api";

export type NotificationAnnouncement = GetAllAnnouncementsResponse["data"][number];

export type NotificationsFeed = {
  announcements: NotificationAnnouncement[];
  hasMore?: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
};
