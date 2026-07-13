import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type ScormDeletionData = {
  scormId: UUIDType;
  actor: ActorUserType;
};

export class DeleteScormEvent {
  constructor(public readonly scormDeletionData: ScormDeletionData) {}
}
