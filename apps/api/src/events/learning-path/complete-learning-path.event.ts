import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type CompleteLearningPathData = {
  learningPathId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class CompleteLearningPathEvent {
  constructor(public readonly completeData: CompleteLearningPathData) {}
}
