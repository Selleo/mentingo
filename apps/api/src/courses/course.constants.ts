import { COURSE_STATUSES, type CourseStatus } from "@repo/shared";

export const COURSE_BULK_STATUS_UPDATE_BATCH_SIZE = 25;

export const COURSE_TRANSLATION_STORAGE_TYPES = {
  JSONB: "jsonb",
  TEXT: "text",
} as const;

export const QUIZ_TRANSLATION_TARGET_TYPES = {
  CHOICE_OPTION: "choice_option",
  TRUE_FALSE_STATEMENT: "true_false_statement",
  DRAG_AND_DROP_OPTION: "drag_and_drop_option",
  BLANK_ANSWER_SET: "blank_answer_set",
} as const;

export const PROTECTED_COURSE_DELETE_STATUSES: CourseStatus[] = [
  COURSE_STATUSES.PUBLISHED,
  COURSE_STATUSES.PRIVATE,
];
