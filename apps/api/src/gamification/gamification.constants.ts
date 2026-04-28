export const POINT_EVENT_TYPES = {
  CHAPTER_COMPLETED: "chapter_completed",
  AI_MENTOR_PASSED: "ai_mentor_passed",
  COURSE_COMPLETED: "course_completed",
} as const;

export type PointEventType = (typeof POINT_EVENT_TYPES)[keyof typeof POINT_EVENT_TYPES];

export const DEFAULT_POINTS = {
  [POINT_EVENT_TYPES.CHAPTER_COMPLETED]: 10,
  [POINT_EVENT_TYPES.AI_MENTOR_PASSED]: 30,
  [POINT_EVENT_TYPES.COURSE_COMPLETED]: 50,
} as const satisfies Record<PointEventType, number>;
