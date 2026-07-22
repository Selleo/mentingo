import { ANNOUNCEMENT_FEEDS, ANNOUNCEMENT_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { announcements, userAnnouncements } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

export const announcementLanguageSchema = Type.Enum(SUPPORTED_LANGUAGES);
export const announcementFeedSchema = Type.Enum(ANNOUNCEMENT_FEEDS);
export const announcementStatusSchema = Type.Enum(ANNOUNCEMENT_STATUSES);

export const baseAnnouncementSchema = Type.Composite([
  Type.Omit(omitTenantId(createSelectSchema(announcements)), [
    "title",
    "content",
    "baseLanguage",
    "availableLocales",
    "deletedAt",
  ]),
  Type.Object({
    title: Type.String(),
    content: Type.String(),
    baseLanguage: announcementLanguageSchema,
    availableLocales: Type.Array(announcementLanguageSchema),
    deletedAt: Type.Union([Type.String(), Type.Null()]),
    scheduledAt: Type.Union([Type.String(), Type.Null()]),
    publishedAt: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const announcementSchema = baseAnnouncementSchema;
export const allAnnouncementsSchema = Type.Array(
  Type.Object({
    ...announcementSchema.properties,
    isRead: Type.Union([Type.Boolean(), Type.Null()]),
  }),
);

export const userAnnouncementsSchema = omitTenantId(
  createSelectSchema(userAnnouncements, {
    readAt: Type.String(),
  }),
);

export const unreadAnnouncementsSchema = Type.Object({ unreadCount: Type.Number() });

export const announcementsForUserSchema = Type.Array(
  Type.Object({ ...baseAnnouncementSchema.properties, isRead: Type.Boolean() }),
);
