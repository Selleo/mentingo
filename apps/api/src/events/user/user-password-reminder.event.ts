import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

type UserPasswordReminder = {
  email: string;
  token: string;
  userId: UUIDType;
  tenantId: UUIDType;
  language?: SupportedLanguages;
  origin?: string;
};

export class UserPasswordReminderEvent {
  constructor(public readonly userPasswordReminder: UserPasswordReminder) {}
}
