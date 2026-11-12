import type { UUIDType } from "src/common";

export type UserActivityType = "LOGIN" | "LESSON_PROGRESS" | "COURSE_PROGRESS";

export type UserActivityData = {
  userId: UUIDType;
  activityType: UserActivityType;
  metadata?: Record<string, any>;
};

export class UserActivityEvent {
  constructor(public readonly userActivityData: UserActivityData) {}
}
