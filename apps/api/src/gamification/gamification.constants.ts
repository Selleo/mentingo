export const POINT_EVENT_TYPES = {
  CHAPTER_COMPLETED: "chapter_completed",
  AI_MENTOR_PASSED: "ai_pass",
  COURSE_COMPLETED: "course_completed",
} as const;

export type PointEventType = (typeof POINT_EVENT_TYPES)[keyof typeof POINT_EVENT_TYPES];

export const GAMIFICATION_POINT_DEFAULTS = {
  CHAPTER_COMPLETED: 10,
  AI_MENTOR_PASSED: 30,
  COURSE_COMPLETED: 50,
} as const;

export const POINT_DEFAULT_SETTING_KEYS = {
  [POINT_EVENT_TYPES.CHAPTER_COMPLETED]: "defaultChapterPoints",
  [POINT_EVENT_TYPES.AI_MENTOR_PASSED]: "defaultAiPassPoints",
  [POINT_EVENT_TYPES.COURSE_COMPLETED]: "defaultCoursePoints",
} as const satisfies Record<PointEventType, string>;
