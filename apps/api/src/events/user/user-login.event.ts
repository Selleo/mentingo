import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export const USER_LOGIN_METHOD = {
  PASSWORD: "password",
  PROVIDER: "provider",
  REFRESH_TOKEN: "refresh_token",
  MAGIC_LINK: "magic_link",
} as const;

export type UserLoginMethod = (typeof USER_LOGIN_METHOD)[keyof typeof USER_LOGIN_METHOD];

type UserLoginData = {
  userId: UUIDType;
  method: UserLoginMethod;
  actor: ActorUserType;
};

export class UserLoginEvent {
  constructor(public readonly loginData: UserLoginData) {}
}
