export const REVIEW_CHANGE_KIND = {
  ADDED: "added",
  EDITED: "edited",
  REMOVED: "removed",
  MOVED: "moved",
  UNCHANGED: "unchanged",
} as const;

export const REVIEW_DECISION = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PARTIAL: "partial",
} as const;

export const PROPOSAL_DECISION = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  SUPERSEDED: "superseded",
  APPLIED: "applied",
} as const;

export const REVIEW_NODE_TYPE = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
} as const;

export const BLOCK_DIFF_STATUS = {
  UNCHANGED: "unchanged",
  MODIFIED: "modified",
  ADDED: "added",
  REMOVED: "removed",
} as const;

export const WORD_DIFF_TYPE = {
  SAME: "same",
  ADDED: "added",
  REMOVED: "removed",
} as const;

export const CONTENT_VIEW_MODE = {
  CHANGES: "changes",
  BEFORE: "before",
  AFTER: "after",
} as const;

export const AUTHORING_OPERATION_TYPE = {
  COURSE_METADATA_UPDATE: "course.metadata.update",
  COURSE_SETTINGS_UPDATE: "course.settings.update",
  CHAPTER_CREATE: "chapter.create",
  CHAPTER_UPDATE: "chapter.update",
  CHAPTER_DELETE: "chapter.delete",
  CHAPTER_REORDER: "chapter.reorder",
  LESSON_CREATE: "lesson.create",
  LESSON_UPDATE: "lesson.update",
  LESSON_METADATA_UPDATE: "lesson.metadata.update",
  LESSON_DELETE: "lesson.delete",
  LESSON_REORDER: "lesson.reorder",
  LESSON_BLOCK_REPLACE: "lesson.block.replace",
  COURSE_LESSON_CREATE: "course.lesson.create",
  COURSE_LESSON_UPDATE: "course.lesson.update",
} as const;

export const CURRICULUM_PREVIEW_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  STREAMING: "streaming",
} as const;

export const REVIEW_SHORTCUT = {
  NEXT: "j",
  PREVIOUS: "k",
  ACCEPT: "a",
  REJECT: "r",
  EXIT: "escape",
} as const;

export const PROPOSAL_APPLICATION_STATUS = {
  SYNCHRONIZING: "synchronizing",
  APPLYING: "applying",
  APPLIED: "applied",
  FAILED: "failed",
  CONFLICT: "conflict",
} as const;

export const COURSE_AUTHORING_FEEDBACK_MAX_LENGTH = 2000;
