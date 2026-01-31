import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type EnrollCourseData = {
  courseId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class EnrollCourseEvent {
  constructor(public readonly enrollmentData: EnrollCourseData) {}
}
