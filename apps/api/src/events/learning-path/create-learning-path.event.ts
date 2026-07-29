import type { LearningPathActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type LearningPathCreationData = {
  learningPathId: UUIDType;
  actor: ActorUserType;
  createdLearningPath: LearningPathActivityLogSnapshot;
};

export class CreateLearningPathEvent {
  constructor(public readonly learningPathCreationData: LearningPathCreationData) {}
}
