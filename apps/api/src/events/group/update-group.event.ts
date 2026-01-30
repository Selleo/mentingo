import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UpdateGroupData = {
  groupId: UUIDType;
  actor: ActorUserType;
  previousGroupData: GroupActivityLogSnapshot | null;
  updatedGroupData: GroupActivityLogSnapshot | null;
};

export class UpdateGroupEvent {
  constructor(public readonly groupUpdateData: UpdateGroupData) {}
}
