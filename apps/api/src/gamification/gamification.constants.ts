import { GAMIFICATION_EVENT_TYPES, type GamificationEventType } from "@repo/shared";

import {
  LessonCompletedEvent,
  QuizCompletedEvent,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";

import type { GamificationEventSource } from "./gamification.types";

/**
 * How each gamification event is read back from `outbox_events`, the source of truth.
 * Keep in sync with GAMIFICATION_OUTBOX_EVENT_TYPES and OUTBOX_EVENT_USER_ID_SQL, which back the partial index.
 */
export const GAMIFICATION_EVENT_SOURCES: Record<GamificationEventType, GamificationEventSource> = {
  [GAMIFICATION_EVENT_TYPES.LOGIN]: {
    outboxEventType: UserLoginEvent.name,
    userIdPath: ["loginData", "userId"],
    supportModePath: ["loginData", "actor", "isSupportMode"],
    // Logins are counted per distinct day.
    subjectPath: null,
    courseIdPath: null,
    scorePath: null,
  },
  [GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED]: {
    outboxEventType: LessonCompletedEvent.name,
    userIdPath: ["lessonCompletionData", "userId"],
    supportModePath: ["lessonCompletionData", "actor", "isSupportMode"],
    subjectPath: ["lessonCompletionData", "lessonId"],
    courseIdPath: ["lessonCompletionData", "courseId"],
    scorePath: null,
  },
  [GAMIFICATION_EVENT_TYPES.COURSE_COMPLETED]: {
    outboxEventType: UserCourseFinishedEvent.name,
    userIdPath: ["courseFinishedData", "userId"],
    supportModePath: ["courseFinishedData", "actor", "isSupportMode"],
    subjectPath: ["courseFinishedData", "courseId"],
    courseIdPath: ["courseFinishedData", "courseId"],
    scorePath: null,
  },
  [GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED]: {
    outboxEventType: QuizCompletedEvent.name,
    userIdPath: ["userId"],
    supportModePath: ["isSupportMode"],
    subjectPath: ["lessonId"],
    courseIdPath: ["courseId"],
    scorePath: ["score"],
  },
};

export const GAMIFICATION_JOBS = {
  EVALUATE_USER: "evaluate-user",
  RECALCULATE_TENANT: "recalculate-tenant",
} as const;

export const GAMIFICATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: true,
  removeOnFail: false,
} as const;

export const RECENT_REWARDS_LIMIT = 5;
