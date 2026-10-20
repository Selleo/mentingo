export const COURSE_LEARNING_TARGET_SOURCES = {
  BODY: "body",
  QUERY: "query",
  PARAMS: "params",
} as const;

export const COURSE_LEARNING_TARGET_FIELDS = {
  ID: "id",
  LESSON_ID: "lessonId",
  THREAD_ID: "threadId",
  ATTEMPT_ID: "attemptId",
} as const;

export const COURSE_LEARNING_TARGET_ENTITIES = {
  LESSON: "lesson",
  THREAD: "thread",
  SCORM: "scorm",
} as const;
