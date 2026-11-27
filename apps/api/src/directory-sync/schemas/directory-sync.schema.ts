import {
  DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE,
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_PROVIDERS,
  DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_RUN_TRIGGERS,
  DIRECTORY_SYNC_SCOPE_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const directorySyncProviderSchema = Type.Enum(DIRECTORY_SYNC_PROVIDERS);

export const directorySyncSetupDetailsSchema = Type.Object({
  clientId: Type.String(),
  scopes: Type.Array(Type.String()),
});

export const directorySyncRoleMappingSchema = Type.Object({
  externalGroupId: Type.String({ minLength: 1 }),
  externalGroupEmail: Type.String({ minLength: 1 }),
  roleId: UUIDSchema,
  priority: Type.Integer({ minimum: 0 }),
});

export const replaceDirectorySyncRoleMappingsSchema = Type.Array(directorySyncRoleMappingSchema);

export const directorySyncGroupMappingSchema = Type.Object({
  externalGroupId: Type.String({ minLength: 1 }),
  externalGroupEmail: Type.String({ minLength: 1 }),
  groupId: UUIDSchema,
  groupName: Type.String(),
});

export const replaceDirectorySyncGroupMappingsSchema = Type.Object({
  language: Type.Enum(SUPPORTED_LANGUAGES),
  groupMappings: Type.Array(
    Type.Object({
      externalGroupId: Type.String({ minLength: 1 }),
      externalGroupEmail: Type.String({ minLength: 1 }),
      externalGroupName: Type.String({ minLength: 1 }),
      groupId: Type.Union([UUIDSchema, Type.Null()]),
    }),
  ),
});

export const directorySyncRunSchema = Type.Object({
  id: UUIDSchema,
  trigger: Type.Enum(DIRECTORY_SYNC_RUN_TRIGGERS),
  status: Type.Enum(DIRECTORY_SYNC_RUN_STATUSES),
  triggeredByUserId: Type.Union([UUIDSchema, Type.Null()]),
  createdAt: Type.String(),
  startedAt: Type.Union([Type.String(), Type.Null()]),
  finishedAt: Type.Union([Type.String(), Type.Null()]),
  createdUsersCount: Type.Integer(),
  linkedUsersCount: Type.Integer(),
  roleChangedUsersCount: Type.Integer(),
  archivedUsersCount: Type.Integer(),
  restoredUsersCount: Type.Integer(),
  groupMembershipChangedUsersCount: Type.Integer(),
  skippedUsersCount: Type.Integer(),
});

export const directorySyncConnectionSchema = Type.Object({
  id: UUIDSchema,
  provider: directorySyncProviderSchema,
  status: Type.Enum(DIRECTORY_SYNC_CONNECTION_STATUSES),
  isVerified: Type.Boolean(),
  administratorEmail: Type.String(),
  scopeType: Type.Enum(DIRECTORY_SYNC_SCOPE_TYPES),
  scopeExternalIds: Type.Array(Type.String()),
  defaultRoleId: UUIDSchema,
  archiveUsersOutsideScope: Type.Boolean(),
  sendWelcomeEmail: Type.Boolean(),
  archiveLimitPercentage: Type.Union([Type.Integer(), Type.Null()]),
  lastSuccessfulSyncAt: Type.Union([Type.String(), Type.Null()]),
  missingExternalIds: Type.Array(Type.String()),
  roleMappings: Type.Array(directorySyncRoleMappingSchema),
  groupMappings: Type.Array(directorySyncGroupMappingSchema),
  latestRun: Type.Union([directorySyncRunSchema, Type.Null()]),
});

export const directorySyncConnectionResponseSchema = Type.Union([
  directorySyncConnectionSchema,
  Type.Null(),
]);

export const upsertDirectorySyncConnectionSchema = Type.Object({
  administratorEmail: Type.String({ format: "email" }),
  scopeType: Type.Enum(DIRECTORY_SYNC_SCOPE_TYPES),
  scopeExternalIds: Type.Array(Type.String({ minLength: 1 })),
  defaultRoleId: UUIDSchema,
  archiveUsersOutsideScope: Type.Boolean(),
  sendWelcomeEmail: Type.Boolean(),
  archiveLimitPercentage: Type.Union([
    Type.Integer({
      minimum: DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MIN,
      maximum: DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MAX,
    }),
    Type.Null(),
  ]),
});

export const directoryOrganizationalUnitSchema = Type.Object({
  externalId: Type.String(),
  path: Type.String(),
  name: Type.String(),
});

export const directoryGroupSchema = Type.Object({
  externalId: Type.String(),
  email: Type.String(),
  name: Type.String(),
});

export type DirectorySyncSetupDetailsResponse = Static<typeof directorySyncSetupDetailsSchema>;
export type DirectorySyncRoleMappingBody = Static<typeof directorySyncRoleMappingSchema>;
export type ReplaceDirectorySyncRoleMappingsBody = Static<
  typeof replaceDirectorySyncRoleMappingsSchema
>;
export type DirectorySyncGroupMappingResponse = Static<typeof directorySyncGroupMappingSchema>;
export type ReplaceDirectorySyncGroupMappingsBody = Static<
  typeof replaceDirectorySyncGroupMappingsSchema
>;
export type DirectorySyncRunResponse = Static<typeof directorySyncRunSchema>;
export type DirectorySyncConnectionResponse = Static<typeof directorySyncConnectionResponseSchema>;
export type UpsertDirectorySyncConnectionBody = Static<typeof upsertDirectorySyncConnectionSchema>;
export type DirectoryOrganizationalUnitResponse = Static<typeof directoryOrganizationalUnitSchema>;
export type DirectoryGroupResponse = Static<typeof directoryGroupSchema>;
