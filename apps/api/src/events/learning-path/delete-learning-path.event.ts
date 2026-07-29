import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type LearningPathDeletionData = {
  learningPathId: UUIDType;
  actor: ActorUserType;
};

export class DeleteLearningPathEvent {
  constructor(public readonly learningPathDeletionData: LearningPathDeletionData) {}
}
