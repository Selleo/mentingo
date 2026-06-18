import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

export type UsersImportImportedUser = {
  email: string;
  userId: UUIDType;
};

export type UsersImportSkippedRow = {
  email: string;
  reason: string;
};

export type UsersImport = {
  actor: ActorUserType;
  tenantId: UUIDType;
  importedUsers: UsersImportImportedUser[];
  skippedRows: UsersImportSkippedRow[];
  importedUsersCount: number;
  skippedRowsCount: number;
};

export class UsersImportEvent {
  constructor(public readonly usersImport: UsersImport) {}
}
