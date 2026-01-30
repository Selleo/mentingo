import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteUserData = {
  userId: UUIDType;
  actor: ActorUserType;
  deletedUserData: UserActivityLogSnapshot | null;
};

export class DeleteUserEvent {
  constructor(public readonly deleteUserData: DeleteUserData) {}
}
