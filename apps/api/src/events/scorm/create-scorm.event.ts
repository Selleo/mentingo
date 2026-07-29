import type { ScormActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type ScormCreationData = {
  scormId: UUIDType;
  actor: ActorUserType;
  createdScorm: ScormActivityLogSnapshot;
};

export class CreateScormEvent {
  constructor(public readonly scormCreationData: ScormCreationData) {}
}
