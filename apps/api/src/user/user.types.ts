import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { DefaultEmailSettings } from "src/events/types";
import type { users } from "src/storage/schema";
import type {
  CreateUserBody,
  ImportUser,
  SkippedUserImport,
} from "src/user/schemas/createUser.schema";

export const USER_CREATION_FLOW_TYPE = {
  ADMIN: "admin",
  REGISTRATION: "registration",
  INVITE: "invite",
  PASSWORD_REMINDER: "password_reminder",
} as const;

export type CreateUserContext =
  | {
      flowType: typeof USER_CREATION_FLOW_TYPE.ADMIN;
      creator: CurrentUserType;
    }
  | {
      flowType: typeof USER_CREATION_FLOW_TYPE.REGISTRATION;
      hashedPassword: string;
    }
  | {
      flowType: typeof USER_CREATION_FLOW_TYPE.INVITE;
      invitedByUserName?: string;
      origin?: string;
    }
  | {
      flowType: typeof USER_CREATION_FLOW_TYPE.PASSWORD_REMINDER;
    };

export type CreateUserCoreResult = {
  createdUser: CreatedUser;
  token?: string;
  newUsersLanguage: SupportedLanguages;
};

export type CreatedUser = InferSelectModel<typeof users>;

export type CreateUsersCoreBulkItem = CreateUserBody & {
  groupIds?: UUIDType[];
  roleIds: UUIDType[];
};

export type CreateUsersCoreBulkUserData = Omit<
  CreateUsersCoreBulkItem,
  "groupIds" | "roleIds" | "roleSlugs"
>;

export type CreateUsersCoreBulkRoleAssignment = {
  userId: UUIDType;
  roleIds: UUIDType[];
};

export type CreateUsersCoreBulkRoleAssignmentInsert = {
  userId: UUIDType;
  roleId: UUIDType;
};

export type CreateUsersCoreBulkCreateTokenInsert = {
  userId: UUIDType;
  tokenHash: string;
  expiryDate: Date;
  reminderCount: number;
};

export type CreateUsersCoreBulkCreateTokenRow = CreateUsersCoreBulkCreateTokenInsert & {
  token: string;
};

export type CreateUsersCoreBulkUserDetailsInsert = {
  userId: UUIDType;
  contactEmail: string;
};

export type CreateUsersCoreBulkCreatedRow = {
  importRow: CreateUsersCoreBulkItem;
  createdUser: CreatedUser;
};

export type CreateUsersCoreBulkResult = {
  createdUser: CreatedUser;
  token: string;
  newUsersLanguage: SupportedLanguages;
  groupIds: UUIDType[];
};

export type UserImportValidationResult = {
  validUsers: CreateUsersCoreBulkItem[];
  skippedUsers: SkippedUserImport[];
};

export type UserImportResolvedGroup = {
  id: UUIDType;
  normalizedName: string;
};

export type UserImportResolvedRole = {
  id: UUIDType;
  slug: string;
};

export type UserImportValidationData = {
  roles: UserImportResolvedRole[];
  groups: UserImportResolvedGroup[];
};

export type UserImportValidationLookupData = {
  emails: string[];
  roleSlugs: string[];
  groupNames: string[];
};

export type UserImportParsedRow = ImportUser;

export type UserImportRowResolutionContext = {
  existingEmails: Set<string>;
  rolesByNormalizedSlug: Map<string, UserImportResolvedRole>;
  groupsByNormalizedName: Map<string, UserImportResolvedGroup[]>;
  isTrainerRoleAvailable: boolean;
  acceptedImportEmails: Set<string>;
};

export type UserImportRowResolvedRoles = {
  roleIds: UUIDType[];
  roleSlugs: string[];
};

export type UserImportValidRowResult = {
  validUser: CreateUsersCoreBulkItem;
};

export type UserImportSkippedRowResult = {
  skippedUser: SkippedUserImport;
};

export type UserImportRowResolutionResult = UserImportValidRowResult | UserImportSkippedRowResult;

export type UserPasswordEmailRecipient = {
  id: UUIDType;
  email: string;
  firstName: string;
  tenantId: UUIDType;
  hasCredentials: boolean;
  defaultEmailSettings: DefaultEmailSettings;
};

export type FindUserPasswordEmailRecipientsByIdsOptions = {
  hasCredentials?: boolean;
};

export type UserPasswordEmailTokenInsert = {
  userId: UUIDType;
  tokenHash: string;
  expiryDate: Date;
};

export type UserCreatePasswordTokenInsert = UserPasswordEmailTokenInsert & {
  reminderCount: number;
};

export type PreparedUserPasswordEmail = {
  userId: UUIDType;
  to: string;
  tenantId: UUIDType;
  subject: string;
  text: string;
  html: string;
};
