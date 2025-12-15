import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteUserData = {
  userId: UUIDType;
  actor: CurrentUser;
  deletedUserData: UserActivityLogSnapshot | null;
};

export class DeleteUserEvent {
  constructor(public readonly deleteUserData: DeleteUserData) {}
}
