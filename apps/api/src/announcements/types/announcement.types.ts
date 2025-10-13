import type { allAnnouncementsSchema, announcementSchema } from "../schemas/announcement.schema";
import type { announcementFiltersSchema } from "../schemas/announcementFilters.schema";
import type { createAnnouncementSchema } from "../schemas/createAnnouncement.schema";
import type { Static } from "@sinclair/typebox";

export type Announcement = Static<typeof announcementSchema>;
export type AllAnnouncements = Static<typeof allAnnouncementsSchema>;
export type AnnouncementFilters = Static<typeof announcementFiltersSchema>;

export type CreateAnnouncement = Static<typeof createAnnouncementSchema>;
