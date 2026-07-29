import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type ScormDeletionItem = {
  scormId: UUIDType;
};

export type ScormDeletionData = {
  scormIds: ScormDeletionItem[];
  actor: ActorUserType;
};

export class DeleteScormEvent {
  constructor(public readonly scormDeletionData: ScormDeletionData) {}
}
