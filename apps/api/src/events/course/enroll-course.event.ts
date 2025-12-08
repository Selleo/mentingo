import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type EnrollCourseData = {
  courseId: UUIDType;
  userId: UUIDType;
  actor: CurrentUser;
};

export class EnrollCourseEvent {
  constructor(public readonly enrollmentData: EnrollCourseData) {}
}
