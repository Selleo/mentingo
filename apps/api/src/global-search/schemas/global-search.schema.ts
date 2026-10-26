import {
  SUPPORTED_LANGUAGES,
  GLOBAL_SEARCH_MODES,
  GLOBAL_SEARCH_RESULT_TYPES,
  GLOBAL_SEARCH_SEMANTIC_STATUSES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";

export const globalSearchQuerySchema = Type.Object({
  searchQuery: Type.String({ maxLength: 500 }),
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  mode: Type.Optional(
    Type.Union([
      Type.Literal(GLOBAL_SEARCH_MODES.KEYWORD),
      Type.Literal(GLOBAL_SEARCH_MODES.HYBRID),
    ]),
  ),
});

const passageProperties = {
  relevanceScore: Type.Optional(
    Type.Number({
      description:
        "Query-local rank fusion score, comparable across content types; not a probability.",
    }),
  ),
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
  courseTitle: Type.Optional(Type.String()),
  chapterTitle: Type.Optional(Type.String()),
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

const lessonResultNodeSchema = Type.Object({
  ...passageProperties,
  type: Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.LESSON),
  id: UUIDSchema,
  title: Type.String(),
  courseId: UUIDSchema,
  chapterTitle: Type.Optional(Type.String()),
});

const courseResultNodeSchema = Type.Object({
  ...passageProperties,
  type: Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.COURSE),
  id: UUIDSchema,
  title: Type.String(),
  category: Type.Optional(Type.String()),
  thumbnailUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  courseChapterCount: Type.Optional(Type.Number()),
  completedChapterCount: Type.Optional(Type.Number()),
  matched: Type.Boolean({
    description: "False when the course is shown only as the parent of matching lessons.",
  }),
  lessons: Type.Array(lessonResultNodeSchema),
  hiddenLessonCount: Type.Number({
    description: "Matching lessons in this course left out of the response to keep groups short.",
  }),
});

const learningPathResultNodeSchema = Type.Object({
  ...passageProperties,
  type: Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH),
  id: UUIDSchema,
  title: Type.String(),
  thumbnailUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  courseCount: Type.Number(),
});

const contentResultNodeSchema = Type.Object({
  ...passageProperties,
  type: Type.Union([
    Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.NEWS),
    Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.ARTICLE),
    Type.Literal(GLOBAL_SEARCH_RESULT_TYPES.QA),
  ]),
  id: UUIDSchema,
  title: Type.String(),
});

export const globalSearchResultNodeSchema = Type.Union([
  courseResultNodeSchema,
  learningPathResultNodeSchema,
  contentResultNodeSchema,
]);

const searchModeSchema = Type.Union([
  Type.Literal(GLOBAL_SEARCH_MODES.KEYWORD),
  Type.Literal(GLOBAL_SEARCH_MODES.HYBRID),
]);

const semanticStatusSchema = Type.Union([
  Type.Literal(GLOBAL_SEARCH_SEMANTIC_STATUSES.READY),
  Type.Literal(GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE),
  Type.Literal(GLOBAL_SEARCH_SEMANTIC_STATUSES.PENDING),
]);

const resultTreeSchema = Type.Array(globalSearchResultNodeSchema, {
  description:
    "Learning content ranked across types, with matching lessons nested under their course.",
});

/**
 * Full service result: per-type lists plus the uncapped result tree. MCP tools project this
 * shape; it is not an HTTP contract.
 */
export const globalSearchResultSchema = Type.Object({
  searchMode: Type.Optional(searchModeSchema),
  semanticStatus: Type.Optional(semanticStatusSchema),
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
  results: resultTreeSchema,
});

/** HTTP response for the search dialog: the result tree plus keyword-only administrative lists. */
export const globalSearchResponseSchema = Type.Object({
  searchMode: Type.Optional(searchModeSchema),
  semanticStatus: Type.Optional(semanticStatusSchema),
  results: resultTreeSchema,
  users: Type.Array(userSearchResultSchema),
  categories: Type.Array(titledSearchResultSchema),
  groups: Type.Array(groupSearchResultSchema),
});

export const globalSearchBaseResponseSchema = baseResponse(globalSearchResponseSchema);

export type GlobalSearchResult = Static<typeof globalSearchResultSchema>;
export type GlobalSearchResponse = Static<typeof globalSearchResponseSchema>;
export type GlobalSearchResultNode = Static<typeof globalSearchResultNodeSchema>;
export type GlobalSearchCourseResultNode = Static<typeof courseResultNodeSchema>;
export type GlobalSearchLessonResultNode = Static<typeof lessonResultNodeSchema>;
export type GlobalSearchMode = NonNullable<Static<typeof globalSearchQuerySchema>["mode"]>;
