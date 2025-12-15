import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type UpdateGroupData = {
  groupId: UUIDType;
  actor: CurrentUser;
  previousGroupData: GroupActivityLogSnapshot | null;
  updatedGroupData: GroupActivityLogSnapshot | null;
};

export class UpdateGroupEvent {
  constructor(public readonly groupUpdateData: UpdateGroupData) {}
}
