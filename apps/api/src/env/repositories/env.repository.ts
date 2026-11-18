import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LEGACY_SSO_ENFORCEMENT_SETTING } from "src/env/login-methods.constants";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { secrets, settings } from "src/storage/schema";

import type { EncryptedEnvBody } from "src/env/env.schema";

@Injectable()
export class EnvRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async lockGlobalSettings() {
    const [globalSettings] = await this.db
      .select({ settings: settings.settings })
      .from(settings)
      .where(isNull(settings.userId))
      .for("update");

    return globalSettings?.settings as Record<string, unknown> | undefined;
  }

  async findTenantIdsWithLegacySSOEnforcementSetting() {
    const tenantSettings = await this.dbAdmin
      .select({ tenantId: settings.tenantId })
      .from(settings)
      .where(
        and(isNull(settings.userId), sql`${settings.settings} ? ${LEGACY_SSO_ENFORCEMENT_SETTING}`),
      );

    return tenantSettings.map(({ tenantId }) => tenantId);
  }

  async removeLegacySSOEnforcementSetting() {
    await this.db
      .update(settings)
      .set({ settings: sql`${settings.settings} - ${LEGACY_SSO_ENFORCEMENT_SETTING}::text` })
      .where(isNull(settings.userId));
  }

  async bulkUpsertEnv(data: EncryptedEnvBody[]) {
    await this.db
      .insert(secrets)
      .values(
        data.map((item) => ({
          secretName: item.name,
          ciphertext: item.ciphertext,
          iv: item.iv,
          tag: item.tag,
          encryptedDek: item.encryptedDek,
          encryptedDekIV: item.dekIv,
          encryptedDekTag: item.dekTag,
          version: item.version,
          alg: item.alg,
        })),
      )
      .onConflictDoUpdate({
        target: [secrets.tenantId, secrets.secretName],
        set: {
          ciphertext: sql.raw(`excluded.${secrets.ciphertext.name}`),
          iv: sql.raw(`excluded.${secrets.iv.name}`),
          tag: sql.raw(`excluded.${secrets.tag.name}`),
          encryptedDek: sql.raw(`excluded.${secrets.encryptedDek.name}`),
          encryptedDekIV: sql.raw(`excluded.${secrets.encryptedDekIV.name}`),
          encryptedDekTag: sql.raw(`excluded.${secrets.encryptedDekTag.name}`),
          version: sql.raw(`secrets.${secrets.version.name} + 1`),
          alg: sql.raw(`excluded.${secrets.alg.name}`),
        },
      });
  }

  async deleteEnvs(envNames: string[]) {
    if (!envNames.length) return;

    await this.db.delete(secrets).where(inArray(secrets.secretName, envNames));
  }

  async getEnv(envName: string) {
    const [env] = await this.db.select().from(secrets).where(eq(secrets.secretName, envName));

    return env;
  }

  async getIsEnvConfigWarningDismissed(userId: string) {
    const [existingSettings] = await this.db
      .select({
        configWarningDismissed: sql<boolean>`(settings.settings->>'configWarningDismissed')::boolean`,
      })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!existingSettings) {
      throw new NotFoundException("User settings not found");
    }

    return existingSettings.configWarningDismissed || false;
  }
}
