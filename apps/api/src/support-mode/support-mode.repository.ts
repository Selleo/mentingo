import { Inject, Injectable } from "@nestjs/common";
import { SUPPORT_SESSION_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, count, eq, gt, ilike, isNull, lte, or, sql } from "drizzle-orm";

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
  FindSupportAdminUsersParams,
  SupportAdminUserRecord,
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

  async findSupportAdminUsers({
    tenantId,
    page,
    perPage,
    search,
  }: FindSupportAdminUsersParams): Promise<SupportAdminUserRecord[]> {
    return this.dbAdmin
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        label: this.getSupportAdminUserLabelSql(),
        avatarReference: users.avatarReference,
      })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(this.buildSupportAdminUserWhereClause(tenantId, search))
      .orderBy(users.firstName, users.lastName, users.email)
      .limit(perPage)
      .offset((page - 1) * perPage);
  }

  async countSupportAdminUsers({
    tenantId,
    search,
  }: Pick<FindSupportAdminUsersParams, "tenantId" | "search">): Promise<number> {
    const [{ totalItems }] = await this.dbAdmin
      .select({ totalItems: count() })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(this.buildSupportAdminUserWhereClause(tenantId, search));

    return totalItems;
  }

  async findSupportAdminUserById(
    tenantId: string,
    targetUserId: string,
  ): Promise<SupportAdminUserRecord | null> {
    const [user] = await this.dbAdmin
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        label: this.getSupportAdminUserLabelSql(),
        avatarReference: users.avatarReference,
      })
      .from(users)
      .innerJoin(
        permissionUserRoles,
        and(
          eq(permissionUserRoles.userId, users.id),
          eq(permissionUserRoles.tenantId, users.tenantId),
        ),
      )
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(and(this.buildSupportAdminUserWhereClause(tenantId), eq(users.id, targetUserId)))
      .limit(1);

    return user ?? null;
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

  private buildSupportAdminUserWhereClause(tenantId: string, search?: string) {
    const conditions = [
      eq(users.tenantId, tenantId),
      eq(users.archived, false),
      isNull(users.deletedAt),
      eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.ADMIN),
    ];

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

  private getSupportAdminUserLabelSql() {
    return sql<string>`concat(${users.firstName}, ' ', ${users.lastName}, ' (', ${users.email}, ')')`;
  }
}
