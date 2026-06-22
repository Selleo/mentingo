import type { UUIDType } from "src/common";

export type UserGroupAssignmentResult = {
  groupIdsToAssign: UUIDType[];
  groupIdsToRemove: UUIDType[];
};
