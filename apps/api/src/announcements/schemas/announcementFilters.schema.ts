import { Type } from "@sinclair/typebox";

export const announcementFiltersSchema = Type.Object({
  title: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
  isRead: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
});
