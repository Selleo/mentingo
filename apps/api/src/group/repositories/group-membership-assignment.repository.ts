import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { groupUsers, groups, settings, users } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { GroupMembershipAssignmentGroup } from "src/group/types/group-membership-assignment.types";

@Injectable()
export class GroupMembershipAssignmentRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  findUserWithGroupMemberships(userId: UUIDType, trx: DatabasePg = this.db) {
    return trx
      .select({
        tenantId: users.tenantId,
        groupId: groupUsers.groupId,
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: sql<string | null>`${settings.settings}->>'language'`,
      })
      .from(users)
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(settings, and(eq(settings.userId, users.id), eq(settings.tenantId, users.tenantId)))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  }

  async findGroupsByIds(
    groupIds: UUIDType[],
    tenantId: UUIDType,
    language: SupportedLanguages,
    trx: DatabasePg = this.db,
  ): Promise<GroupMembershipAssignmentGroup[]> {
    if (!groupIds.length) return [];

    return trx
      .select({
        id: groups.id,
        name: this.localizationService.getLocalizedSqlField(groups.name, language, groups),
      })
      .from(groups)
      .where(and(inArray(groups.id, groupIds), eq(groups.tenantId, tenantId)));
  }

  async deleteUserGroupMemberships(
    userId: UUIDType,
    groupIds: UUIDType[],
    trx: DatabasePg = this.db,
  ): Promise<void> {
    if (!groupIds.length) return;

    await trx
      .delete(groupUsers)
      .where(and(eq(groupUsers.userId, userId), inArray(groupUsers.groupId, groupIds)));
  }

  async insertUserGroupMemberships(
    userId: UUIDType,
    groupIds: UUIDType[],
    tenantId: UUIDType,
    trx: DatabasePg = this.db,
  ): Promise<{ groupId: UUIDType }[]> {
    if (!groupIds.length) return [];

    return trx
      .insert(groupUsers)
      .values(groupIds.map((groupId) => ({ userId, groupId, tenantId })))
      .onConflictDoNothing()
      .returning({ groupId: groupUsers.groupId });
  }
}
