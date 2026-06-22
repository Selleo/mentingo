import type { UUIDType } from "src/common";

export type UsersImportInviteEmailRecipient = {
  email: string;
  userId: UUIDType;
  token: string;
};

export type UsersImportInviteEmails = {
  tenantId: UUIDType;
  creatorId: UUIDType;
  origin?: string;
  invitedByUserName?: string;
  recipients: UsersImportInviteEmailRecipient[];
};

export class UsersImportInviteEmailsEvent {
  constructor(public readonly usersImportInviteEmails: UsersImportInviteEmails) {}
}
