import type { UUIDType } from "src/common";

export type UserInvite = {
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
