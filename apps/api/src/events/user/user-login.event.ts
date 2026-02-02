import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type UserLoginMethod = "password" | "provider" | "refresh_token" | "magic_link";

type UserLoginData = {
  userId: UUIDType;
  method: UserLoginMethod;
  actor: ActorUserType;
};

export class UserLoginEvent {
  constructor(public readonly loginData: UserLoginData) {}
}
