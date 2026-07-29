import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type StartLearningPathData = {
  learningPathId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class StartLearningPathEvent {
  constructor(public readonly startData: StartLearningPathData) {}
}
