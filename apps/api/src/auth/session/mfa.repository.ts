import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_ERROR_KEYS } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { permissionRoles, permissionUserRoles, settings, users } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { MfaPolicy } from "./session.types";
import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
} from "src/settings/schemas/settings.schema";

@Injectable()
export class MfaRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  /** Reads the user, their MFA settings, the tenant's enforced roles and the user's roles in one query. */
  async getUserMfaPolicy(tenantId: string, userId: string): Promise<MfaPolicy> {
    const personalSettings = alias(settings, "personal_settings");
    const globalSettings = alias(settings, "global_settings");

    return this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [source] = await this.db
        .select({
          personal: sql<SettingsJSONContentSchema | null>`${personalSettings.settings}`,
          global: sql<GlobalSettingsJSONContentSchema | null>`${globalSettings.settings}`,
          roleSlugs: sql<
            string[]
          >`coalesce(array_agg(${permissionRoles.slug}) filter (where ${permissionRoles.slug} is not null), '{}')`,
        })
        .from(users)
        .leftJoin(personalSettings, eq(personalSettings.userId, users.id))
        .leftJoin(
          globalSettings,
          and(isNull(globalSettings.userId), eq(globalSettings.tenantId, users.tenantId)),
        )
        .leftJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
        .leftJoin(permissionRoles, eq(permissionUserRoles.roleId, permissionRoles.id))
        .where(
          and(
            eq(users.id, userId),
            eq(users.tenantId, tenantId),
            eq(users.archived, false),
            isNull(users.deletedAt),
          ),
        )
        .groupBy(users.id, personalSettings.id, globalSettings.id);

      if (!source?.personal || !source.global || typeof source.personal.isMFAEnabled !== "boolean")
        throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

      const enforcedRoles = source.global.MFAEnforcedRoles;

      return {
        required:
          source.personal.isMFAEnabled ||
          source.roleSlugs.some((slug) => enforcedRoles.includes(slug)),
        enabled: source.personal.isMFAEnabled,
        secret: source.personal.MFASecret,
      };
    });
  }

  async withLockedUserMfaSettings<T>(
    tenantId: string,
    userId: string,
    fn: (value: SettingsJSONContentSchema, enable: (secret: string) => Promise<void>) => Promise<T>,
  ): Promise<T> {
    return this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.tenantDbRunnerService.transactionWithHandle(async (trx) => {
        const [row] = await trx
          .select({ value: sql<SettingsJSONContentSchema>`${settings.settings}` })
          .from(settings)
          .where(eq(settings.userId, userId))
          .for("update");

        if (!row) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
        return fn(row.value, async (secret) => {
          await trx
            .update(settings)
            .set({
              settings: settingsToJSONBuildObject({
                ...row.value,
                MFASecret: secret,
                isMFAEnabled: true,
              }),
            })
            .where(eq(settings.userId, userId));
        });
      }),
    );
  }
}
