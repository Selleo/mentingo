import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CreateUserData = {
  userId: UUIDType;
  actor: CurrentUser;
  createdUserData: UserActivityLogSnapshot | null;
};

export class CreateUserEvent {
  constructor(public readonly userCreationData: CreateUserData) {}
}
