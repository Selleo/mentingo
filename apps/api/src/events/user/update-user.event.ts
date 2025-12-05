import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type UpdateUserData = {
  userId: UUIDType;
  updatedById: UUIDType;
  previousUserData: UserActivityLogSnapshot | null;
  updatedUserData: UserActivityLogSnapshot | null;
};

export class UpdateUserEvent {
  constructor(public readonly userUpdateData: UpdateUserData) {}
}
