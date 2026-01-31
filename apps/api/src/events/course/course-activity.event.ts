import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CourseCompletedDetails = {
  courseId: UUIDType;
  userName: string;
  courseTitle: string;
};

type CourseStartedData = {
  userId: UUIDType;
  courseId: UUIDType;
  actor: ActorUserType;
};

export class CourseStartedEvent {
  constructor(public readonly courseStartedData: CourseStartedData) {}
}

export class CourseCompletedEvent {
  constructor(public readonly courseCompletionData: CourseCompletedDetails) {}
}
