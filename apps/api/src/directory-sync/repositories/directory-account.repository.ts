import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  groupUsers,
  groups,
  permissionRoles,
  permissionUserRoles,
  userExternalIdentities,
  users,
} from "src/storage/schema";

import type { DirectorySyncProvider } from "@repo/shared";

@Injectable()
export class DirectoryAccountRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findAccountsByEmailsWithLinkedIdentity(
    provider: DirectorySyncProvider,
    lowercasedEmails: string[],
  ) {
    if (!lowercasedEmails.length) return [];

    return this.db
      .select({
        userId: users.id,
        email: users.email,
        isArchived: users.archived,
        linkedExternalId: userExternalIdentities.externalId,
      })
      .from(users)
      .leftJoin(
        userExternalIdentities,
        and(
          eq(userExternalIdentities.userId, users.id),
          eq(userExternalIdentities.provider, provider),
        ),
      )
      .where(
        and(inArray(sql<string>`lower(${users.email})`, lowercasedEmails), isNull(users.deletedAt)),
      );
  }

  async findRoleSlugsForUsers(userIds: UUIDType[]) {
    if (!userIds.length) return [];

    return this.db
      .select({ userId: permissionUserRoles.userId, roleSlug: permissionRoles.slug })
      .from(permissionUserRoles)
      .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(inArray(permissionUserRoles.userId, userIds));
  }

  async findActiveUserIdsWithRoleSlug(roleSlug: string) {
    return this.db
      .selectDistinct({ userId: users.id })
      .from(users)
      .innerJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(
        and(eq(permissionRoles.slug, roleSlug), eq(users.archived, false), isNull(users.deletedAt)),
      );
  }

  async findActiveUserEmailById(userId: UUIDType) {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)))
      .limit(1);

    return user?.email ?? null;
  }

  async findRolesByIds(roleIds: UUIDType[]) {
    if (!roleIds.length) return [];

    return this.db
      .select({ id: permissionRoles.id, slug: permissionRoles.slug })
      .from(permissionRoles)
      .where(inArray(permissionRoles.id, roleIds));
  }

  async findGroupIdsForUsers(userIds: UUIDType[]) {
    if (!userIds.length) return [];

    return this.db
      .select({ userId: groupUsers.userId, groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(inArray(groupUsers.userId, userIds));
  }

  async findGroupIdsByIds(groupIds: UUIDType[]) {
    if (!groupIds.length) return [];

    return this.db.select({ id: groups.id }).from(groups).where(inArray(groups.id, groupIds));
  }
}
