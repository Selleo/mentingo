import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_ERROR_KEYS } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

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

  async getUserMfaPolicy(tenantId: string, userId: string): Promise<MfaPolicy> {
    return this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [user] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.tenantId, tenantId),
            eq(users.archived, false),
            isNull(users.deletedAt),
          ),
        );

      if (!user) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

      const [personal] = await this.db
        .select({ value: sql<SettingsJSONContentSchema>`${settings.settings}` })
        .from(settings)
        .where(eq(settings.userId, userId));

      const [global] = await this.db
        .select({ value: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
        .from(settings)
        .where(isNull(settings.userId));

      if (!personal || !global || typeof personal.value.isMFAEnabled !== "boolean")
        throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

      const roles = await this.db
        .select({ slug: permissionRoles.slug })
        .from(permissionUserRoles)
        .innerJoin(permissionRoles, eq(permissionUserRoles.roleId, permissionRoles.id))
        .where(eq(permissionUserRoles.userId, userId));

      return {
        required:
          personal.value.isMFAEnabled ||
          roles.some(({ slug }) => global.value.MFAEnforcedRoles.includes(slug)),
        enabled: personal.value.isMFAEnabled,
        secret: personal.value.MFASecret,
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
