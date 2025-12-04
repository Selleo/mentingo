import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CreateGroupData = {
  groupId: UUIDType;
  createdById: UUIDType;
  group: GroupActivityLogSnapshot;
};

export class CreateGroupEvent {
  constructor(public readonly groupData: CreateGroupData) {}
}
