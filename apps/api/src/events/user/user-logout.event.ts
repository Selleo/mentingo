import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type UserLogoutData = {
  userId: UUIDType;
  actor: CurrentUser;
};

export class UserLogoutEvent {
  constructor(public readonly logoutData: UserLogoutData) {}
}
