import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type DeleteUserData = {
  userId: UUIDType;
  deletedById: UUIDType;
  deletedUserData: UserActivityLogSnapshot | null;
};

export class DeleteUserEvent {
  constructor(public readonly deleteUserData: DeleteUserData) {}
}
