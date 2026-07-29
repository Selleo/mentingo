import { ANNOUNCEMENT_AUDIENCES } from "../constants/AnnouncementAudience";

export type AnnouncementAudience =
  (typeof ANNOUNCEMENT_AUDIENCES)[keyof typeof ANNOUNCEMENT_AUDIENCES];
