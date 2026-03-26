import type { UserLoginMethod } from "./user-login.event";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type UserLoginFailedData = {
  userId: UUIDType;
  method: UserLoginMethod;
  actor: ActorUserType;
  error?: string;
};

export class UserLoginFailedEvent {
  constructor(public readonly loginFailedData: UserLoginFailedData) {}
}
