import type { ENTITY_TYPES } from "@repo/shared";

export type CourseContentEntityType =
  | typeof ENTITY_TYPES.CHAPTER
  | typeof ENTITY_TYPES.COURSE
  | typeof ENTITY_TYPES.LESSON;
