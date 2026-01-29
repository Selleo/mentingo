import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type EnrollGroupToCourseData = {
  courseId: UUIDType;
  groupId: UUIDType;
  actor: ActorUserType;
};

export class EnrollGroupToCourseEvent {
  constructor(public readonly enrollmentData: EnrollGroupToCourseData) {}
}
