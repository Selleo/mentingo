import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingUpdateData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  previousLiveTrainingData: LiveTrainingActivityLogSnapshot | null;
  updatedLiveTrainingData: LiveTrainingActivityLogSnapshot | null;
  context?: Record<string, string>;
};

export class UpdateLiveTrainingEvent {
  constructor(public readonly liveTrainingUpdateData: LiveTrainingUpdateData) {}
}
