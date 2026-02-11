import type { UUIDType } from "src/common";

export type UserActivityType = "LOGIN" | "LESSON_PROGRESS" | "COURSE_PROGRESS";

type UserActivityData = {
  userId: UUIDType;
  activityType: UserActivityType;
  metadata?: Record<string, any>;
};

export class UserActivityEvent {
  public readonly userId: UUIDType;
  public readonly activityType: UserActivityType;
  public readonly metadata?: Record<string, any>;

  constructor(data: UserActivityData) {
    this.userId = data.userId;
    this.activityType = data.activityType;
    this.metadata = data.metadata;
  }
}
