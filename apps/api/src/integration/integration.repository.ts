import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { integrationApiKeys, tenants, users } from "src/storage/schema";

import type {
  FindIntegrationKeyCandidateParams,
  IntegrationApiKeyCandidate,
  IntegrationKeyMetadataRecord,
  RotateIntegrationKeyParams,
} from "./integration.types";

@Injectable()
export class IntegrationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async getCurrentActiveKeyByCreator(userId: string): Promise<IntegrationKeyMetadataRecord | null> {
    const [key] = await this.dbAdmin
      .select({
        id: integrationApiKeys.id,
        keyPrefix: integrationApiKeys.keyPrefix,
        createdAt: integrationApiKeys.createdAt,
        updatedAt: integrationApiKeys.updatedAt,
        lastUsedAt: integrationApiKeys.lastUsedAt,
      })
      .from(integrationApiKeys)
      .where(
        and(eq(integrationApiKeys.createdByUserId, userId), isNull(integrationApiKeys.revokedAt)),
      )
      .limit(1);

    return key ?? null;
  }

  async rotateAdminKey(
    params: RotateIntegrationKeyParams,
  ): Promise<IntegrationKeyMetadataRecord | null> {
    const [createdKey] = await this.db.transaction(async (trx) => {
      await trx
        .update(integrationApiKeys)
        .set({ revokedAt: sql`NOW()` })
        .where(
          and(
            eq(integrationApiKeys.createdByUserId, params.userId),
            isNull(integrationApiKeys.revokedAt),
          ),
        );

      return trx
        .insert(integrationApiKeys)
        .values({
          keyPrefix: params.keyPrefix,
          keyHash: params.keyHash,
          tenantId: params.tenantId,
          createdByUserId: params.userId,
        })
        .returning({
          id: integrationApiKeys.id,
          keyPrefix: integrationApiKeys.keyPrefix,
          createdAt: integrationApiKeys.createdAt,
          updatedAt: integrationApiKeys.updatedAt,
          lastUsedAt: integrationApiKeys.lastUsedAt,
        });
    });

    return createdKey ?? null;
  }

  async getActiveKeyCandidate(
    params: FindIntegrationKeyCandidateParams,
  ): Promise<IntegrationApiKeyCandidate | null> {
    const [key] = await this.dbAdmin
      .select({
        keyId: integrationApiKeys.id,
        keyHash: integrationApiKeys.keyHash,
        keyTenantId: integrationApiKeys.tenantId,
        keyTenantIsManaging: tenants.isManaging,
        userId: users.id,
        userEmail: users.email,
        userRole: users.role,
        userDeletedAt: users.deletedAt,
      })
      .from(integrationApiKeys)
      .innerJoin(users, eq(users.id, integrationApiKeys.createdByUserId))
      .innerJoin(tenants, eq(tenants.id, integrationApiKeys.tenantId))
      .where(
        and(
          eq(integrationApiKeys.keyPrefix, params.keyPrefix),
          isNull(integrationApiKeys.revokedAt),
        ),
      )
      .limit(1);

    return key;
  }

  async getAllTenants() {
    return this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
      })
      .from(tenants)
      .orderBy(tenants.name);
  }

  async getTenantById(tenantId: string) {
    const [tenant] = await this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        isManaging: tenants.isManaging,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant ?? null;
  }

  async markKeyAsUsed(keyId: string): Promise<void> {
    await this.dbAdmin
      .update(integrationApiKeys)
      .set({ lastUsedAt: sql`NOW()` })
      .where(eq(integrationApiKeys.id, keyId));
  }
}
