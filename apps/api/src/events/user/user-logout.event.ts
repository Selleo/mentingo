import type { UUIDType } from "src/common";

type UserLogoutData = {
  userId: UUIDType;
};

export class UserLogoutEvent {
  constructor(public readonly logoutData: UserLogoutData) {}
}
