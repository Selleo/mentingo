import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { users } from "src/storage/schema";

export type CreateUserOptions = { invite?: { invitedByUserName?: string; origin?: string } };

export type CreatedUser = InferSelectModel<typeof users>;

export type CreateUserTransactionResult = {
  createdUser: CreatedUser;
  token: string;
  newUsersLanguage: SupportedLanguages;
};
