import { UUIDType } from "src/common";

type CourseCompletedDetails = {
  courseId: UUIDType;
  userName: string;
  courseTitle: string;
};

export class CourseStartedEvent {
  constructor(
    public readonly userId: UUIDType,
    public readonly courseId: UUIDType,
  ) {}
}

export class CourseCompletedEvent {
  constructor(public readonly courseCompletionData: CourseCompletedDetails) {}
}
