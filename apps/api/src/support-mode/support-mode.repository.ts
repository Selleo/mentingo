import { Inject, Injectable } from "@nestjs/common";
import { SUPPORT_SESSION_STATUSES } from "@repo/shared";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { supportSessions, tenants } from "src/storage/schema";

import type {
  CreateSupportSessionRecord,
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

  async createSupportSession(supportSessionRecord: CreateSupportSessionRecord): Promise<void> {
    await this.dbAdmin.insert(supportSessions).values(supportSessionRecord);
  }

  async consumeGrantByHash(
    grantHashValue: string,
    currentTimestampIso: string,
  ): Promise<SupportSession | null> {
    return this.dbAdmin.transaction(async (transaction) => {
      const [pendingSession] = await transaction
        .select()
        .from(supportSessions)
        .where(
          and(
            eq(supportSessions.grantHash, grantHashValue),
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
            grantUsedAt: currentTimestampIso,
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
}
