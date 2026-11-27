import { Inject, Injectable } from "@nestjs/common";
import { and, eq, getTableColumns, inArray, isNull } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { userExternalIdentities, users } from "src/storage/schema";

import type { DirectorySyncProvider } from "@repo/shared";

export type UserExternalIdentityInsert = typeof userExternalIdentities.$inferInsert;

@Injectable()
export class UserExternalIdentityRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findLinkedAccountsForConnection(connectionId: UUIDType) {
    return this.db
      .select({
        userId: userExternalIdentities.userId,
        externalId: userExternalIdentities.externalId,
        archivedByDirectorySync: userExternalIdentities.archivedByDirectorySync,
        rolesOverridden: userExternalIdentities.rolesOverridden,
        isArchived: users.archived,
      })
      .from(userExternalIdentities)
      .innerJoin(users, eq(users.id, userExternalIdentities.userId))
      .where(and(eq(userExternalIdentities.connectionId, connectionId), isNull(users.deletedAt)));
  }

  async findIdentityByUserId(userId: UUIDType) {
    const [identity] = await this.db
      .select()
      .from(userExternalIdentities)
      .where(eq(userExternalIdentities.userId, userId))
      .limit(1);

    return identity ?? null;
  }

  async findUserByExternalIdentity(provider: DirectorySyncProvider, externalId: string) {
    const [user] = await this.db
      .select(getTableColumns(users))
      .from(userExternalIdentities)
      .innerJoin(users, eq(users.id, userExternalIdentities.userId))
      .where(
        and(
          eq(userExternalIdentities.provider, provider),
          eq(userExternalIdentities.externalId, externalId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  async insertIdentities(identities: UserExternalIdentityInsert[]) {
    if (!identities.length) return [];

    return this.db.insert(userExternalIdentities).values(identities).returning();
  }

  async updateArchivedByDirectorySync(
    connectionId: UUIDType,
    userIds: UUIDType[],
    archivedByDirectorySync: boolean,
  ) {
    if (!userIds.length) return;

    await this.db
      .update(userExternalIdentities)
      .set({ archivedByDirectorySync })
      .where(
        and(
          eq(userExternalIdentities.connectionId, connectionId),
          inArray(userExternalIdentities.userId, userIds),
        ),
      );
  }

  async markRolesOverridden(connectionId: UUIDType, userIds: UUIDType[]) {
    if (!userIds.length) return;

    await this.db
      .update(userExternalIdentities)
      .set({ rolesOverridden: true })
      .where(
        and(
          eq(userExternalIdentities.connectionId, connectionId),
          inArray(userExternalIdentities.userId, userIds),
        ),
      );
  }

  async clearRolesOverridden(userId: UUIDType) {
    const [identity] = await this.db
      .update(userExternalIdentities)
      .set({ rolesOverridden: false })
      .where(eq(userExternalIdentities.userId, userId))
      .returning({ userId: userExternalIdentities.userId });

    return identity ?? null;
  }
}
