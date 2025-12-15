import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type UserCourseFinished = {
  courseId: UUIDType;
  userId: UUIDType;
  actor: CurrentUser;
};

export class UserCourseFinishedEvent {
  constructor(public readonly courseFinishedData: UserCourseFinished) {}
}
