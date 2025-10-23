import type { UUIDType } from "src/common";

type UserCourseFinished = {
  courseId: UUIDType;
  userId: UUIDType;
};

export class UserCourseFinishedEvent {
  constructor(public readonly courseFinishedData: UserCourseFinished) {}
}
