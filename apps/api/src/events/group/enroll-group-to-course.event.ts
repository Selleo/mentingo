import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type EnrollGroupToCourseData = {
  courseId: UUIDType;
  groupId: UUIDType;
  actor: CurrentUser;
};

export class EnrollGroupToCourseEvent {
  constructor(public readonly enrollmentData: EnrollGroupToCourseData) {}
}
