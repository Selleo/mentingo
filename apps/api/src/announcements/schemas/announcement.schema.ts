import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { announcements, userAnnouncements } from "src/storage/schema";

export const baseAnnouncementSchema = createSelectSchema(announcements);

export const announcementSchema = Type.Composite([
  baseAnnouncementSchema,
  Type.Object({
    authorName: Type.String(),
    authorProfilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  }),
]);
export const allAnnouncementsSchema = Type.Array(announcementSchema);

export const userAnnouncementsSchema = createSelectSchema(userAnnouncements);

export const unreadAnnouncementsSchema = Type.Object({ unreadCount: Type.Number() });
