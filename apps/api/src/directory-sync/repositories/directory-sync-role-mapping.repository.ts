import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { directorySyncRoleMappings, permissionRoles } from "src/storage/schema";

export type DirectorySyncRoleMappingInsert = typeof directorySyncRoleMappings.$inferInsert;

@Injectable()
export class DirectorySyncRoleMappingRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findRoleMappingsWithRoleSlugs(connectionId: UUIDType) {
    return this.db
      .select({
        externalGroupId: directorySyncRoleMappings.externalGroupId,
        externalGroupEmail: directorySyncRoleMappings.externalGroupEmail,
        priority: directorySyncRoleMappings.priority,
        roleId: directorySyncRoleMappings.roleId,
        roleSlug: permissionRoles.slug,
      })
      .from(directorySyncRoleMappings)
      .innerJoin(permissionRoles, eq(permissionRoles.id, directorySyncRoleMappings.roleId))
      .where(eq(directorySyncRoleMappings.connectionId, connectionId))
      .orderBy(asc(directorySyncRoleMappings.priority));
  }

  async deleteRoleMappingsForConnection(connectionId: UUIDType) {
    await this.db
      .delete(directorySyncRoleMappings)
      .where(eq(directorySyncRoleMappings.connectionId, connectionId));
  }

  async insertRoleMappings(roleMappings: DirectorySyncRoleMappingInsert[]) {
    if (!roleMappings.length) return [];

    return this.db.insert(directorySyncRoleMappings).values(roleMappings).returning();
  }
}
