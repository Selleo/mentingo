import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS, SUPPORT_SESSION_STATUSES, SUPPORT_USER_SCOPES } from "@repo/shared";
import { and, asc, count, eq, exists, gt, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  permissionRoles,
  permissionUserRoles,
  supportSessions,
  tenants,
  users,
} from "src/storage/schema";

import type {
  CreateSupportSessionRecord,
  FindSupportUsersParams,
  SupportUserRecord,
  SupportUserRole,
  SupportUserScope,
  SupportSession,
  SupportTenant,
} from "./support-mode.types";

@Injectable()
export class SupportModeRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async findTenantById(tenantId: string): Promise<SupportTenant | null> {
    const [tenant] = await this.dbAdmin
      .select({ id: tenants.id, name: tenants.name, host: tenants.host, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant ?? null;
  }

  async findSupportUsers({
    tenantId,
    page,
    perPage,
    search,
    scope,
    roleSlug,
  }: FindSupportUsersParams): Promise<SupportUserRecord[]> {
    const records = await this.dbAdmin
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        label: this.getSupportUserLabelSql(),
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(this.buildSupportUserWhereClause({ tenantId, search, scope, roleSlug }))
      .orderBy(asc(users.firstName), asc(users.lastName), asc(users.email), asc(users.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const rolesByUserId = await this.findRolesByUserIds(
      tenantId,
      records.map(({ id }) => id),
    );

    return records.map((record) => ({
      ...record,
      roles: rolesByUserId.get(record.id) ?? [],
    }));
  }

  async countSupportUsers({
    tenantId,
    search,
    scope,
    roleSlug,
  }: Pick<FindSupportUsersParams, "tenantId" | "search" | "scope" | "roleSlug">): Promise<number> {
    const [{ totalItems }] = await this.dbAdmin
      .select({ totalItems: count() })
      .from(users)
      .where(this.buildSupportUserWhereClause({ tenantId, search, scope, roleSlug }));

    return totalItems;
  }

  async findSupportUserById(
    tenantId: string,
    targetUserId: string,
  ): Promise<SupportUserRecord | null> {
    const [user] = await this.dbAdmin
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        label: this.getSupportUserLabelSql(),
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, targetUserId),
          eq(users.archived, false),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!user) return null;

    const rolesByUserId = await this.findRolesByUserIds(tenantId, [user.id]);

    return {
      ...user,
      roles: rolesByUserId.get(user.id) ?? [],
    };
  }

  async findSupportRoles(tenantId: string): Promise<SupportUserRole[]> {
    return this.dbAdmin
      .select({
        id: permissionRoles.id,
        slug: permissionRoles.slug,
        name: permissionRoles.name,
        isSystem: permissionRoles.isSystem,
      })
      .from(permissionRoles)
      .where(eq(permissionRoles.tenantId, tenantId))
      .orderBy(
        sql<number>`CASE
          WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.ADMIN} THEN 0
          WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.CONTENT_CREATOR} THEN 1
          WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.TRAINER} THEN 2
          WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT} THEN 3
          ELSE 999
        END`,
        asc(permissionRoles.name),
      );
  }

  async createSupportSession(supportSessionRecord: CreateSupportSessionRecord): Promise<void> {
    await this.dbAdmin.insert(supportSessions).values(supportSessionRecord);
  }

  async consumeGrantByHash(
    hashedGrantTokenValue: string,
    currentTimestampIso: string,
  ): Promise<SupportSession | null> {
    return this.dbAdmin.transaction(async (transaction) => {
      const [pendingSession] = await transaction
        .select()
        .from(supportSessions)
        .where(
          and(
            eq(supportSessions.hashedGrantToken, hashedGrantTokenValue),
            eq(supportSessions.status, SUPPORT_SESSION_STATUSES.PENDING),
            isNull(supportSessions.revokedAt),
            gt(supportSessions.grantExpiresAt, currentTimestampIso),
          ),
        )
        .limit(1)
        .for("update");

      if (pendingSession) {
        const [activatedSession] = await transaction
          .update(supportSessions)
          .set({
            status: SUPPORT_SESSION_STATUSES.ACTIVE,
            activatedAt: currentTimestampIso,
          })
          .where(eq(supportSessions.id, pendingSession.id))
          .returning();

        return activatedSession ?? null;
      }
      return null;
    });
  }

  async revokeOtherActiveSessions(
    originalUserId: string,
    targetTenantId: string,
    revokedAtTimestampIso: string,
  ): Promise<void> {
    await this.dbAdmin
      .update(supportSessions)
      .set({
        status: SUPPORT_SESSION_STATUSES.REVOKED,
        revokedAt: revokedAtTimestampIso,
      })
      .where(
        and(
          eq(supportSessions.originalUserId, originalUserId),
          eq(supportSessions.targetTenantId, targetTenantId),
          eq(supportSessions.status, SUPPORT_SESSION_STATUSES.ACTIVE),
          isNull(supportSessions.revokedAt),
          gt(supportSessions.expiresAt, revokedAtTimestampIso),
        ),
      );
  }

  async revokeSession(supportSessionId: string, revokedAtTimestampIso: string): Promise<void> {
    await this.dbAdmin
      .update(supportSessions)
      .set({ status: SUPPORT_SESSION_STATUSES.REVOKED, revokedAt: revokedAtTimestampIso })
      .where(eq(supportSessions.id, supportSessionId));
  }

  async findActiveSession(
    supportSessionId: string,
    currentTimestampIso: string,
  ): Promise<SupportSession | null> {
    const [session] = await this.dbAdmin
      .select()
      .from(supportSessions)
      .where(
        and(
          eq(supportSessions.id, supportSessionId),
          eq(supportSessions.status, SUPPORT_SESSION_STATUSES.ACTIVE),
          isNull(supportSessions.revokedAt),
          gt(supportSessions.expiresAt, currentTimestampIso),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async revokeExpiredSessions(currentTimestampIso: string): Promise<number> {
    const revoked = await this.dbAdmin
      .update(supportSessions)
      .set({
        status: SUPPORT_SESSION_STATUSES.REVOKED,
        revokedAt: currentTimestampIso,
      })
      .where(
        and(
          or(
            eq(supportSessions.status, SUPPORT_SESSION_STATUSES.PENDING),
            eq(supportSessions.status, SUPPORT_SESSION_STATUSES.ACTIVE),
          ),
          isNull(supportSessions.revokedAt),
          lte(supportSessions.expiresAt, currentTimestampIso),
        ),
      )
      .returning({ id: supportSessions.id });

    return revoked.length;
  }

  private buildSupportUserWhereClause({
    tenantId,
    search,
    scope,
    roleSlug,
  }: {
    tenantId: string;
    search?: string;
    scope: SupportUserScope;
    roleSlug?: string;
  }) {
    const conditions = [
      eq(users.tenantId, tenantId),
      eq(users.archived, false),
      isNull(users.deletedAt),
    ];

    const selectedRoleSlug =
      scope === SUPPORT_USER_SCOPES.ADMINS ? SYSTEM_ROLE_SLUGS.ADMIN : roleSlug?.trim();

    if (selectedRoleSlug) {
      conditions.push(
        exists(
          this.dbAdmin
            .select({ userId: permissionUserRoles.userId })
            .from(permissionUserRoles)
            .innerJoin(
              permissionRoles,
              and(
                eq(permissionRoles.id, permissionUserRoles.roleId),
                eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
              ),
            )
            .where(
              and(
                eq(permissionUserRoles.userId, users.id),
                eq(permissionUserRoles.tenantId, tenantId),
                eq(permissionRoles.slug, selectedRoleSlug),
              ),
            ),
        ),
      );
    }

    const normalizedSearch = search?.trim();

    if (normalizedSearch) {
      const searchPattern = `%${normalizedSearch}%`;

      const searchCondition = or(
        ilike(users.firstName, searchPattern),
        ilike(users.lastName, searchPattern),
        ilike(users.email, searchPattern),
      );

      if (searchCondition) conditions.push(searchCondition);
    }

    return and(...conditions);
  }

  private async findRolesByUserIds(
    tenantId: string,
    userIds: string[],
  ): Promise<Map<string, SupportUserRole[]>> {
    if (!userIds.length) return new Map();

    const rows = await this.dbAdmin
      .select({
        userId: permissionUserRoles.userId,
        id: permissionRoles.id,
        slug: permissionRoles.slug,
        name: permissionRoles.name,
        isSystem: permissionRoles.isSystem,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(
        and(
          eq(permissionUserRoles.tenantId, tenantId),
          inArray(permissionUserRoles.userId, userIds),
        ),
      )
      .orderBy(asc(permissionRoles.name));

    const rolesByUserId = new Map<string, SupportUserRole[]>();

    for (const row of rows) {
      const roles = rolesByUserId.get(row.userId) ?? [];
      roles.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        isSystem: row.isSystem,
      });
      rolesByUserId.set(row.userId, roles);
    }

    return rolesByUserId;
  }

  private getSupportUserLabelSql() {
    return sql<string>`concat(${users.firstName}, ' ', ${users.lastName}, ' (', ${users.email}, ')')`;
  }
}
