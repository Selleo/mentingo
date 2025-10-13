import { Type } from "@sinclair/typebox";

export const announcementFiltersSchema = Type.Object({
  title: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
  isRead: Type.Optional(Type.Boolean()),
  authorName: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
});
