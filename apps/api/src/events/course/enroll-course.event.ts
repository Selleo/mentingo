import type { UUIDType } from "src/common";

type EnrollCourseData = {
  courseId: UUIDType;
  userId: UUIDType;
  enrolledById?: UUIDType | null;
};

export class EnrollCourseEvent {
  constructor(public readonly enrollmentData: EnrollCourseData) {}
}
