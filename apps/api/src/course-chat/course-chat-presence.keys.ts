import type { UUIDType } from "src/common";

const COURSE_CHAT_PRESENCE_KEY_PREFIX = "course-chat:presence";

export const COURSE_CHAT_PRESENCE_TTL_SECONDS = 60 * 5;

export const getCourseChatPresenceSocketMembershipsKey = (socketId: string) =>
  `${COURSE_CHAT_PRESENCE_KEY_PREFIX}:socket:${socketId}:memberships`;

export const getCourseChatPresenceCourseUserSocketsKey = (courseId: UUIDType, userId: UUIDType) =>
  `${COURSE_CHAT_PRESENCE_KEY_PREFIX}:course:${courseId}:user:${userId}:sockets`;

export const getCourseChatPresenceCourseOnlineUsersKey = (courseId: UUIDType) =>
  `${COURSE_CHAT_PRESENCE_KEY_PREFIX}:course:${courseId}:online-users`;

export const getCourseChatPresenceMembershipKey = (courseId: UUIDType, userId: UUIDType) =>
  `${courseId}:${userId}`;
