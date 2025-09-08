import { UUIDType } from "src/common";

type CourseCompletedDetails = {
  usersName: string;
  courseTitle: string;
  groupName: string;
  completedAt: string;
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
