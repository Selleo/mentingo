import type { LearningPathActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type LearningPathUpdateData = {
  learningPathId: UUIDType;
  actor: ActorUserType;
  previousLearningPathData: LearningPathActivityLogSnapshot | null;
  updatedLearningPathData: LearningPathActivityLogSnapshot | null;
};

export class UpdateLearningPathEvent {
  constructor(public readonly learningPathUpdateData: LearningPathUpdateData) {}
}
