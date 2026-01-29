import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UpdateUserData = {
  userId: UUIDType;
  actor: ActorUserType;
  previousUserData: UserActivityLogSnapshot | null;
  updatedUserData: UserActivityLogSnapshot | null;
};

export class UpdateUserEvent {
  constructor(public readonly userUpdateData: UpdateUserData) {}
}
