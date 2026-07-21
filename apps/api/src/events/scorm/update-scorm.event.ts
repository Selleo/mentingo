import type { ScormActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type ScormUpdateData = {
  scormId: UUIDType;
  actor: ActorUserType;
  previousScormData: ScormActivityLogSnapshot | null;
  updatedScormData: ScormActivityLogSnapshot | null;
};

export class UpdateScormEvent {
  constructor(public readonly scormUpdateData: ScormUpdateData) {}
}
