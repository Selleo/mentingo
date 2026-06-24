import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { PreparedUserPasswordEmail } from "src/user/user.types";

export const USER_PASSWORD_EMAIL_TYPES = {
  RESET: "reset",
  CREATION: "creation",
} as const;

export type UserPasswordEmailType =
  (typeof USER_PASSWORD_EMAIL_TYPES)[keyof typeof USER_PASSWORD_EMAIL_TYPES];

export type UserPasswordEmailRecipient = {
  userId: UUIDType;
  email: string;
};

export type UserPasswordEmails = {
  actor: ActorUserType;
  tenantId: UUIDType;
  type: UserPasswordEmailType;
  emails: PreparedUserPasswordEmail[];
  recipients: UserPasswordEmailRecipient[];
  sentCount: number;
  skippedCount: number;
};

export class UserPasswordEmailsEvent {
  constructor(public readonly userPasswordEmails: UserPasswordEmails) {}
}
