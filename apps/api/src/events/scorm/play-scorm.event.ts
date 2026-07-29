import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type PlayScormData = {
  scormId: UUIDType;
  actor: ActorUserType;
  userId: UUIDType;
};

export class PlayScormEvent {
  constructor(public readonly playData: PlayScormData) {}
}
