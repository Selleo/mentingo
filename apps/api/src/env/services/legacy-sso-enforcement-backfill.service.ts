import { Injectable, Logger } from "@nestjs/common";
import { LOGIN_METHODS } from "@repo/shared";

import {
  LEGACY_SSO_ENFORCEMENT_SETTING,
  LOGIN_METHOD_ENV_KEYS,
} from "src/env/login-methods.constants";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

@Injectable()
export class LegacySSOEnforcementBackfillService {
  private readonly logger = new Logger(LegacySSOEnforcementBackfillService.name);

  constructor(
    private readonly envRepository: EnvRepository,
    private readonly envService: EnvService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  /**
   * Converts only the tenants whose settings still hold the retired setting. A failing tenant is
   * logged and keeps its setting, so it is retried on the next startup without blocking others.
   */
  async convertLegacySSOEnforcementForAllTenants() {
    const tenantIds = await this.envRepository.findTenantIdsWithLegacySSOEnforcementSetting();

    for (const tenantId of tenantIds) {
      try {
        await this.tenantDbRunnerService.runWithTenant(tenantId, () =>
          this.convertLegacySSOEnforcementToLoginMethods(),
        );
      } catch (error) {
        this.logger.error(
          `Failed to convert legacy SSO enforcement for tenant ${tenantId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  /**
   * Replaces the retired `enforceSSO` global setting with the organization login method it
   * stood for: an enforcing tenant gets password login disabled. The setting is then removed,
   * so login methods remain the only authentication policy.
   */
  async convertLegacySSOEnforcementToLoginMethods() {
    await this.tenantDbRunnerService.transaction(async () => {
      const globalSettings = await this.envRepository.lockGlobalSettings();

      if (!globalSettings || !(LEGACY_SSO_ENFORCEMENT_SETTING in globalSettings)) return;

      if (globalSettings[LEGACY_SSO_ENFORCEMENT_SETTING] === true) {
        await this.envService.bulkUpsertInternalEnv([
          { name: LOGIN_METHOD_ENV_KEYS[LOGIN_METHODS.PASSWORD].enabledFlag, value: "false" },
        ]);
      }

      await this.envRepository.removeLegacySSOEnforcementSetting();
    });
  }
}
