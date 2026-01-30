import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

export type UserLoginMethod = "password" | "provider" | "refresh_token" | "magic_link";

type UserLoginData = {
  userId: UUIDType;
  method: UserLoginMethod;
  actor: CurrentUser;
};

export class UserLoginEvent {
  constructor(public readonly loginData: UserLoginData) {}
}
