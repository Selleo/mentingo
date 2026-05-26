import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingDeleteData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  deletedLiveTrainingData: LiveTrainingActivityLogSnapshot | null;
};

export class DeleteLiveTrainingEvent {
  constructor(public readonly liveTrainingDeleteData: LiveTrainingDeleteData) {}
}
