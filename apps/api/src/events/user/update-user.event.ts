import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type UpdateUserData = {
  userId: UUIDType;
  actor: CurrentUser;
  previousUserData: UserActivityLogSnapshot | null;
  updatedUserData: UserActivityLogSnapshot | null;
};

export class UpdateUserEvent {
  constructor(public readonly userUpdateData: UpdateUserData) {}
}
