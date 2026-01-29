import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UserCourseFinished = {
  courseId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class UserCourseFinishedEvent {
  constructor(public readonly courseFinishedData: UserCourseFinished) {}
}
