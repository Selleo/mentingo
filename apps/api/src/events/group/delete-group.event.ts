import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteGroupData = {
  groupId: UUIDType;
  actor: ActorUserType;
  groupName?: string | null;
};

export class DeleteGroupEvent {
  constructor(public readonly deleteGroupData: DeleteGroupData) {}
}
