import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type UpdateGroupData = {
  groupId: UUIDType;
  updatedById: UUIDType;
  previousGroupData: GroupActivityLogSnapshot | null;
  updatedGroupData: GroupActivityLogSnapshot | null;
};

export class UpdateGroupEvent {
  constructor(public readonly groupUpdateData: UpdateGroupData) {}
}
