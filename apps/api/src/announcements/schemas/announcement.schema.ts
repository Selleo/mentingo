import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { announcements, userAnnouncements } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

export const baseAnnouncementSchema = omitTenantId(createSelectSchema(announcements));

export const announcementSchema = Type.Composite([
  baseAnnouncementSchema,
  Type.Object({
    authorName: Type.String(),
    authorProfilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  }),
]);
export const allAnnouncementsSchema = Type.Array(announcementSchema);

export const userAnnouncementsSchema = omitTenantId(
  createSelectSchema(userAnnouncements, {
    readAt: Type.String(),
  }),
);

export const unreadAnnouncementsSchema = Type.Object({ unreadCount: Type.Number() });

export const announcementsForUserSchema = Type.Array(
  Type.Object({ ...announcementSchema.properties, isRead: Type.Boolean() }),
);
