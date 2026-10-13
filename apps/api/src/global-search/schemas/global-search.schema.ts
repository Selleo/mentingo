import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";

export const globalSearchQuerySchema = Type.Object({
  searchQuery: Type.String({ maxLength: 500 }),
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  mode: Type.Optional(Type.Union([Type.Literal("keyword"), Type.Literal("hybrid")])),
});

const passageProperties = {
  matchedPassage: Type.Optional(Type.String()),
  matchedAttachmentFileName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
};

const courseSearchResultSchema = Type.Object({
  ...passageProperties,
  id: UUIDSchema,
  title: Type.String(),
  category: Type.Optional(Type.String()),
  thumbnailUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  courseChapterCount: Type.Optional(Type.Number()),
  completedChapterCount: Type.Optional(Type.Number()),
});

const learningPathSearchResultSchema = Type.Object({
  ...passageProperties,
  id: UUIDSchema,
  title: Type.String(),
  thumbnailReference: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  courses: Type.Array(Type.Object({ id: UUIDSchema })),
});

const lessonSearchResultSchema = Type.Object({
  ...passageProperties,
  id: UUIDSchema,
  title: Type.String(),
  courseId: UUIDSchema,
});

const titledSearchResultSchema = Type.Object({
  ...passageProperties,
  id: UUIDSchema,
  title: Type.String(),
});

const userSearchResultSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  email: Type.String(),
  profilePictureUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  groups: Type.Array(Type.Object({ id: UUIDSchema, name: Type.String() })),
});

const groupSearchResultSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
});

export const globalSearchResponseSchema = Type.Object({
  searchMode: Type.Optional(Type.Union([Type.Literal("keyword"), Type.Literal("hybrid")])),
  semanticStatus: Type.Optional(
    Type.Union([Type.Literal("ready"), Type.Literal("unavailable"), Type.Literal("pending")]),
  ),
  allCourses: Type.Array(courseSearchResultSchema),
  myCourses: Type.Array(courseSearchResultSchema),
  availableCourses: Type.Array(courseSearchResultSchema),
  learningPaths: Type.Array(learningPathSearchResultSchema),
  lessons: Type.Array(lessonSearchResultSchema),
  news: Type.Array(titledSearchResultSchema),
  articles: Type.Array(titledSearchResultSchema),
  qa: Type.Array(titledSearchResultSchema),
  users: Type.Array(userSearchResultSchema),
  categories: Type.Array(titledSearchResultSchema),
  groups: Type.Array(groupSearchResultSchema),
});

export const globalSearchBaseResponseSchema = baseResponse(globalSearchResponseSchema);

export type GlobalSearchResponse = Static<typeof globalSearchResponseSchema>;
export type GlobalSearchMode = NonNullable<Static<typeof globalSearchQuerySchema>["mode"]>;
