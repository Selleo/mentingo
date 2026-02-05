import type { UUIDType } from "src/common";
import type { DefaultEmailSettings } from "src/events/types";

export type UserInvite = DefaultEmailSettings & {
  creatorId?: string;
  invitedByUserName?: string;
  origin?: string;
  token: string;
  email: string;
  userId: UUIDType;
  tenantId: UUIDType;
};

export class UserInviteEvent {
  constructor(public readonly userInvite: UserInvite) {}
}
