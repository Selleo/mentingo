import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { directorySyncGroupMappings, userExternalIdentities } from "src/storage/schema";

@Injectable()
export class GroupDirectoryMembershipRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  /** Groups among the given ones whose membership the user's directory connection manages. */
  async findDirectoryManagedGroupIdsForUser(
    userId: UUIDType,
    groupIds: UUIDType[],
    trx: DatabasePg = this.db,
  ) {
    if (!groupIds.length) return [];

    return trx
      .selectDistinct({ groupId: directorySyncGroupMappings.groupId })
      .from(directorySyncGroupMappings)
      .innerJoin(
        userExternalIdentities,
        eq(userExternalIdentities.connectionId, directorySyncGroupMappings.connectionId),
      )
      .where(
        and(
          eq(userExternalIdentities.userId, userId),
          inArray(directorySyncGroupMappings.groupId, groupIds),
        ),
      );
  }

  async findMappedGroupIds(groupIds: UUIDType[]) {
    if (!groupIds.length) return [];

    return this.db
      .selectDistinct({ groupId: directorySyncGroupMappings.groupId })
      .from(directorySyncGroupMappings)
      .where(inArray(directorySyncGroupMappings.groupId, groupIds));
  }
}
