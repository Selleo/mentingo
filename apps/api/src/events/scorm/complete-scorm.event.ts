import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type CompleteScormData = {
  scormId: UUIDType;
  actor: ActorUserType;
  userId: UUIDType;
};

export class CompleteScormEvent {
  constructor(public readonly completeData: CompleteScormData) {}
}
