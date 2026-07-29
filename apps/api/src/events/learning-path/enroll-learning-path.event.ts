import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type EnrollLearningPathData = {
  learningPathId: UUIDType;
  userIds: UUIDType[];
  actor: ActorUserType;
  groupIds?: UUIDType[];
};

export class EnrollLearningPathEvent {
  constructor(public readonly enrollmentData: EnrollLearningPathData) {}
}
