import type { UUIDType } from "src/common";

type UserFirstLogin = {
  userId: UUIDType;
};

export class UserFirstLoginEvent {
  constructor(public readonly userFirstLogin: UserFirstLogin) {}
}
