import type { UUIDType } from "src/common";

export type UserLoginMethod = "password" | "provider" | "refresh_token";

type UserLoginData = {
  userId: UUIDType;
  method?: UserLoginMethod;
};

export class UserLoginEvent {
  constructor(public readonly loginData: UserLoginData) {}
}
