import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type CourseDeletionItem = {
  courseId: UUIDType;
  courseTitle?: string | null;
};

export type CourseDeletionData = {
  courses: CourseDeletionItem[];
  actor: ActorUserType;
};

export class DeleteCourseEvent {
  constructor(public readonly courseDeletionData: CourseDeletionData) {}
}
