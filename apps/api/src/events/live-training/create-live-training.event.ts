import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingCreationData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  createdLiveTraining: LiveTrainingActivityLogSnapshot;
};

export class CreateLiveTrainingEvent {
  constructor(public readonly liveTrainingCreationData: LiveTrainingCreationData) {}
}
