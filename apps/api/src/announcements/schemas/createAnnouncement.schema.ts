import { Type } from "@sinclair/typebox";
import { createInsertSchema } from "drizzle-typebox";

import { announcements } from "src/storage/schema";

const refinedAnnouncementSchema = createInsertSchema(announcements, {
  title: Type.String({ minLength: 1, maxLength: 120 }),
  content: Type.String({ minLength: 1 }),
});

const createEveryoneTargetSchema = Type.Object({
  target: Type.Object({ type: Type.Literal("everyone") }),
});

const createGroupTargetSchema = Type.Object({
  target: Type.Object({ type: Type.Literal("group"), groupId: Type.String({ format: "uuid" }) }),
});

export const createAnnouncementSchema = Type.Composite([
  Type.Omit(refinedAnnouncementSchema, ["id", "authorId", "createdAt", "updatedAt", "isEveryone"]),
  Type.Union([createEveryoneTargetSchema, createGroupTargetSchema]),
]);
