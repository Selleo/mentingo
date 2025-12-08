import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CourseCompletedDetails = {
  courseId: UUIDType;
  userName: string;
  courseTitle: string;
};

type CourseStartedData = {
  userId: UUIDType;
  courseId: UUIDType;
  actor: CurrentUser;
};

export class CourseStartedEvent {
  constructor(public readonly courseStartedData: CourseStartedData) {}
}

export class CourseCompletedEvent {
  constructor(public readonly courseCompletionData: CourseCompletedDetails) {}
}
