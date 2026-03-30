import type { InferSelectModel } from "drizzle-orm";
import type { CommonUser } from "src/common/schemas/common-user.schema";
import type { UserLoginMethod } from "src/events/user/user-login.event";
import type { magicLinkTokens } from "src/storage/schema";
import type { UserResponse } from "src/user/schemas/user.schema";

export type TokenUser = (CommonUser | UserResponse) & { tenantId: string };
export type MagicLinkToken = InferSelectModel<typeof magicLinkTokens>;

export type RegisterUserWithHashedPasswordInput = {
  email: string;
  firstName: string;
  lastName: string;
  language: string;
  hashedPassword: string;
};

export type AuthFailedData = {
  email: string;
  method: UserLoginMethod;
  error?: string;
};
