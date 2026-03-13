import { type Static, Type } from "@sinclair/typebox";

import type { UUIDType } from "src/common";

export const lessonSortFields = ["title", "createdAt", "state", "itemsCount"] as const;

export const LessonSortFields: Record<LessonSortField, LessonSortField> = {
  title: "title",
  createdAt: "createdAt",
  state: "state",
  itemsCount: "itemsCount",
};

export type LessonSortField = (typeof lessonSortFields)[number];

export const sortLessonFieldsOptions = Type.Union([
  Type.Literal("title"),
  Type.Literal("createdAt"),
  Type.Literal("state"),
  Type.Literal("itemsCount"),
  Type.Literal("-title"),
  Type.Literal("-createdAt"),
  Type.Literal("-state"),
  Type.Literal("-itemsCount"),
]);

export type SortLessonFieldsOptions = Static<typeof sortLessonFieldsOptions>;

export const lessonsFilterSchema = Type.Object({
  title: Type.Optional(Type.String()),
  state: Type.Optional(Type.String()),
  archived: Type.Optional(Type.Boolean()),
});

export type LessonsFilterSchema = Static<typeof lessonsFilterSchema>;

export type LessonsQuery = {
  filters?: LessonsFilterSchema;
  sort?: SortLessonFieldsOptions;
  page?: number;
  perPage?: number;
  currentUserId?: UUIDType;
};
