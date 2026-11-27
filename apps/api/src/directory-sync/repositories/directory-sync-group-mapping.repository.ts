import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { directorySyncGroupMappings, groups } from "src/storage/schema";

export type DirectorySyncGroupMappingInsert = typeof directorySyncGroupMappings.$inferInsert;

@Injectable()
export class DirectorySyncGroupMappingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findGroupMappings(connectionId: UUIDType) {
    return this.db
      .select({
        externalGroupId: directorySyncGroupMappings.externalGroupId,
        externalGroupEmail: directorySyncGroupMappings.externalGroupEmail,
        groupId: directorySyncGroupMappings.groupId,
        groupName: this.localizationService.getLocalizedSqlField(groups.name, undefined, groups),
      })
      .from(directorySyncGroupMappings)
      .innerJoin(groups, eq(groups.id, directorySyncGroupMappings.groupId))
      .where(eq(directorySyncGroupMappings.connectionId, connectionId))
      .orderBy(asc(directorySyncGroupMappings.externalGroupEmail));
  }

  async deleteGroupMappingsForConnection(connectionId: UUIDType) {
    await this.db
      .delete(directorySyncGroupMappings)
      .where(eq(directorySyncGroupMappings.connectionId, connectionId));
  }

  async insertGroupMappings(groupMappings: DirectorySyncGroupMappingInsert[]) {
    if (!groupMappings.length) return [];

    return this.db.insert(directorySyncGroupMappings).values(groupMappings).returning();
  }
}
