import { Type } from "@sinclair/typebox";
import { createInsertSchema } from "drizzle-typebox";

import { announcements } from "src/storage/schema";

const refinedAnnouncementSchema = createInsertSchema(announcements, {
  title: Type.String({ minLength: 1, maxLength: 120 }),
  content: Type.String({ minLength: 1 }),
});

export const createAnnouncementSchema = Type.Composite([
  Type.Omit(refinedAnnouncementSchema, ["id", "authorId", "createdAt", "updatedAt", "isEveryone"]),
  Type.Object({
    groupId: Type.Union([Type.String(), Type.Null()], { default: null }),
  }),
]);
