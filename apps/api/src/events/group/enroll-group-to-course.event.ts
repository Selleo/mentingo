import type { UUIDType } from "src/common";

type EnrollGroupToCourseData = {
  courseId: UUIDType;
  groupId: UUIDType;
  enrolledById: UUIDType;
};

export class EnrollGroupToCourseEvent {
  constructor(public readonly enrollmentData: EnrollGroupToCourseData) {}
}
