import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UserLogoutData = {
  userId: UUIDType;
  actor: ActorUserType;
};

export class UserLogoutEvent {
  constructor(public readonly logoutData: UserLogoutData) {}
}
