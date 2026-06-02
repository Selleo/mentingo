import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingMaterialsUpdateData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  previousLiveTrainingData: LiveTrainingActivityLogSnapshot | null;
  updatedLiveTrainingData: LiveTrainingActivityLogSnapshot | null;
  context: Record<string, string>;
};

export class UpdateLiveTrainingMaterialsEvent {
  constructor(public readonly liveTrainingMaterialsUpdateData: LiveTrainingMaterialsUpdateData) {}
}
