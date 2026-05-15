import type { UUIDType } from "src/common";

export type CourseChatPresenceChange = {
  courseId: UUIDType;
  userId: UUIDType;
  isOnline: boolean;
};

export type CourseChatPresenceMembership = {
  courseId: UUIDType;
  userId: UUIDType;
};
