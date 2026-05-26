import type {
  GetAllAnnouncementsResponse,
  GetAnnouncementsForUserResponse,
} from "~/api/generated-api";

export type NotificationAnnouncement =
  | GetAnnouncementsForUserResponse["data"][number]
  | (GetAllAnnouncementsResponse["data"][number] & { isRead?: boolean });
