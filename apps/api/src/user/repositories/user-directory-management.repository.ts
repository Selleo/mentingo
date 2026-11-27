import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, countDistinct, eq, inArray, isNull } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  permissionRoles,
  permissionUserRoles,
  userExternalIdentities,
  users,
} from "src/storage/schema";

@Injectable()
export class UserDirectoryManagementRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findDirectoryManagedUserIds(userIds: UUIDType[]) {
    if (!userIds.length) return [];

    return this.db
      .selectDistinct({ userId: userExternalIdentities.userId })
      .from(userExternalIdentities)
      .where(inArray(userExternalIdentities.userId, userIds));
  }

  async markRolesOverridden(userIds: UUIDType[], trx: DatabasePg = this.db) {
    if (!userIds.length) return;

    await trx
      .update(userExternalIdentities)
      .set({ rolesOverridden: true })
      .where(inArray(userExternalIdentities.userId, userIds));
  }

  async clearArchivedByDirectorySync(userIds: UUIDType[], trx: DatabasePg = this.db) {
    if (!userIds.length) return;

    await trx
      .update(userExternalIdentities)
      .set({ archivedByDirectorySync: false })
      .where(inArray(userExternalIdentities.userId, userIds));
  }

  async countActiveAdmins(trx: DatabasePg = this.db) {
    const [{ activeAdminCount }] = await trx
      .select({ activeAdminCount: countDistinct(users.id) })
      .from(users)
      .innerJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(
        and(
          eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.ADMIN),
          eq(users.archived, false),
          isNull(users.deletedAt),
        ),
      );

    return activeAdminCount;
  }
}
