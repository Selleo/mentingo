import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingSessionFailData = {
  liveTrainingId: UUIDType;
  sessionId: UUIDType;
  actor: ActorUserType;
  liveTraining: LiveTrainingActivityLogSnapshot | null;
  context: Record<string, string>;
};

export class FailLiveTrainingSessionEvent {
  constructor(public readonly liveTrainingSessionFailData: LiveTrainingSessionFailData) {}
}
