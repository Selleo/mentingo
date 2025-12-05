import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CreateUserData = {
  userId: UUIDType;
  createdById: UUIDType;
  createdUserData: UserActivityLogSnapshot | null;
};

export class CreateUserEvent {
  constructor(public readonly userCreationData: CreateUserData) {}
}
