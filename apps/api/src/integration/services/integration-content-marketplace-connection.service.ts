import { Injectable, NotFoundException } from "@nestjs/common";

import { CONTENT_MARKETPLACE_ENV } from "src/content-marketplace/content-marketplace.constants";
import { ContentMarketplaceClientService } from "src/content-marketplace/services/content-marketplace-client.service";
import { EnvService } from "src/env/services/env.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { IntegrationRepository } from "../integration.repository";
import { toPluginOrigin } from "../utils/integration-plugin-origin.utils";
import { assertCanManageTenants } from "../utils/integration-tenant-access.utils";

import type { IntegrationKeyTenantContext } from "../integration.types";
import type {
  IntegrationContentMarketplaceConnection,
  IntegrationPluginConfigured,
  IntegrationPluginStatus,
} from "../schemas/integration-plugin-connection.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

/** Connects tenants to the content marketplace plugin, which Mission Control does on the operator's behalf. */
@Injectable()
export class IntegrationContentMarketplaceConnectionService {
  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly envService: EnvService,
    private readonly tenantDbRunner: TenantDbRunnerService,
    private readonly contentMarketplaceClientService: ContentMarketplaceClientService,
  ) {}

  async saveContentMarketplaceConnection(
    tenantId: UUIDType,
    input: IntegrationContentMarketplaceConnection,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginConfigured> {
    assertCanManageTenants(actor, keyTenant);
    await this.assertTenantExists(tenantId);

    const origin = toPluginOrigin(input.baseUrl);

    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.bulkUpsertEnv(
        [
          { name: CONTENT_MARKETPLACE_ENV.BASE_URL, value: origin },
          { name: CONTENT_MARKETPLACE_ENV.API_KEY, value: input.apiKey },
        ],
        { ...actor, tenantId },
      ),
    );

    return { tenantId };
  }

  /** Reports whether the tenant reaches the plugin with its saved credentials; never returns them. */
  async checkContentMarketplaceConnection(
    tenantId: UUIDType,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginStatus> {
    assertCanManageTenants(actor, keyTenant);
    await this.assertTenantExists(tenantId);

    return this.tenantDbRunner.runWithTenant(tenantId, async () => {
      try {
        const [baseUrl, apiKey] = await Promise.all([
          this.envService.getEnv(CONTENT_MARKETPLACE_ENV.BASE_URL),
          this.envService.getEnv(CONTENT_MARKETPLACE_ENV.API_KEY),
        ]);
        const configuration = await this.contentMarketplaceClientService.fetchConfiguration({
          baseUrl: baseUrl.value,
          apiKey: apiKey.value,
          tenantId,
        });

        return {
          tenantId,
          reachable: true,
          enabled: configuration.capabilities.contentMarketplace.enabled,
        };
      } catch {
        return { tenantId, reachable: false, enabled: false };
      }
    });
  }

  private async assertTenantExists(tenantId: UUIDType) {
    if (!(await this.integrationRepository.getTenantById(tenantId)))
      throw new NotFoundException("superAdminTenants.error.notFound");
  }
}
