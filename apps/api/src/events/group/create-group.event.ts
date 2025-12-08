import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CreateGroupData = {
  groupId: UUIDType;
  actor: CurrentUser;
  group: GroupActivityLogSnapshot;
};

export class CreateGroupEvent {
  constructor(public readonly groupData: CreateGroupData) {}
}
