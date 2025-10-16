import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const archiveUsersSchema = Type.Object({
  userIds: Type.Array(UUIDSchema),
});

export type ArchiveUsersSchema = Static<typeof archiveUsersSchema>;

export const archiveUsersSchemaResponse = Type.Object({
  archivedUsersCount: Type.Number(),
  usersAlreadyArchivedCount: Type.Number(),
});

export type ArchiveUsersSchemaResponse = Static<typeof archiveUsersSchemaResponse>;
