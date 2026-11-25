import { LESSON_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

export const TRACKED_COURSE_CONTENT = [{ lessonTypes: [LESSON_TYPES.CONTENT] }];

export const HEARTBEAT_SECONDS = 10;

export const COURSE_AUTHORSHIP = {
  AUTHOR: "the learner authored the course",
  OTHER_AUTHOR: "another user authored the course",
} as const;

export type CourseAuthorship = (typeof COURSE_AUTHORSHIP)[keyof typeof COURSE_AUTHORSHIP];

export const LEARNER_ACCESS = {
  NOT_ENROLLED: "not enrolled",
  ENROLLED: "enrolled",
  LEARNING_MODE: "learning in learning mode",
  LEARNING_MODE_TURNED_OFF: "enrolled after turning learning mode off",
} as const;

export type LearnerAccess = (typeof LEARNER_ACCESS)[keyof typeof LEARNER_ACCESS];

export const LEARNER_ACCESS_CASES = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
    access: LEARNER_ACCESS.ENROLLED,
    expectedSeconds: HEARTBEAT_SECONDS,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
    access: LEARNER_ACCESS.NOT_ENROLLED,
    expectedSeconds: 0,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
    access: LEARNER_ACCESS.ENROLLED,
    expectedSeconds: HEARTBEAT_SECONDS,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    authorship: COURSE_AUTHORSHIP.AUTHOR,
    access: LEARNER_ACCESS.ENROLLED,
    expectedSeconds: 0,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    authorship: COURSE_AUTHORSHIP.AUTHOR,
    access: LEARNER_ACCESS.LEARNING_MODE,
    expectedSeconds: HEARTBEAT_SECONDS,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    authorship: COURSE_AUTHORSHIP.AUTHOR,
    access: LEARNER_ACCESS.LEARNING_MODE_TURNED_OFF,
    expectedSeconds: 0,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
    access: LEARNER_ACCESS.ENROLLED,
    expectedSeconds: 0,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    authorship: COURSE_AUTHORSHIP.OTHER_AUTHOR,
    access: LEARNER_ACCESS.LEARNING_MODE,
    expectedSeconds: HEARTBEAT_SECONDS,
  },
];

export const SESSION_STEPS = {
  JOIN: "join",
  ACTIVE_HEARTBEAT: "active heartbeat",
  IDLE_HEARTBEAT: "idle heartbeat",
  LEAVE: "leave",
  DISCONNECT: "disconnect",
  EXPIRE_LESSON_SESSION: "expire lesson session",
  EXPIRE_SOCKET_SESSIONS: "expire socket sessions",
} as const;

export type SessionStep = (typeof SESSION_STEPS)[keyof typeof SESSION_STEPS];

const { JOIN, ACTIVE_HEARTBEAT, IDLE_HEARTBEAT, LEAVE, DISCONNECT } = SESSION_STEPS;
const { EXPIRE_LESSON_SESSION, EXPIRE_SOCKET_SESSIONS } = SESSION_STEPS;

export const SESSION_LIFECYCLE_CASES = [
  {
    behaviour: "records nothing when the learner leaves before the first heartbeat",
    steps: [JOIN, LEAVE],
    expectedSeconds: 0,
  },
  {
    behaviour: "records time under a minute when the learner leaves",
    steps: [JOIN, ACTIVE_HEARTBEAT, ACTIVE_HEARTBEAT, LEAVE],
    expectedSeconds: 20,
  },
  {
    behaviour: "records time under a minute when the socket disconnects",
    steps: [JOIN, ACTIVE_HEARTBEAT, ACTIVE_HEARTBEAT, ACTIVE_HEARTBEAT, DISCONNECT],
    expectedSeconds: 30,
  },
  {
    behaviour: "skips idle heartbeats",
    steps: [JOIN, ACTIVE_HEARTBEAT, IDLE_HEARTBEAT, IDLE_HEARTBEAT, IDLE_HEARTBEAT, LEAVE],
    expectedSeconds: 10,
  },
  {
    behaviour: "records each full minute while the learner stays and the rest on leave",
    steps: [JOIN, ...Array<SessionStep>(7).fill(ACTIVE_HEARTBEAT), LEAVE],
    expectedSeconds: 70,
  },
  {
    behaviour: "does not record the same time twice when leave is followed by a disconnect",
    steps: [JOIN, ACTIVE_HEARTBEAT, LEAVE, DISCONNECT],
    expectedSeconds: 10,
  },
  {
    behaviour: "records a session restarted by a heartbeat after the cache expired it",
    steps: [
      JOIN,
      ACTIVE_HEARTBEAT,
      EXPIRE_LESSON_SESSION,
      EXPIRE_SOCKET_SESSIONS,
      ACTIVE_HEARTBEAT,
      ACTIVE_HEARTBEAT,
      ACTIVE_HEARTBEAT,
      DISCONNECT,
    ],
    expectedSeconds: 20,
  },
  {
    behaviour: "records a long session on disconnect after the socket session index expired",
    steps: [JOIN, ACTIVE_HEARTBEAT, EXPIRE_SOCKET_SESSIONS, ACTIVE_HEARTBEAT, DISCONNECT],
    expectedSeconds: 20,
  },
];
