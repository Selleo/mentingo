import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CreateUserData = {
  userId: UUIDType;
  actor: ActorUserType;
  createdUserData: UserActivityLogSnapshot | null;
};

export class CreateUserEvent {
  constructor(public readonly userCreationData: CreateUserData) {}
}
