import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

import { createCompetenciesClient } from "@mentingo/competencies-sdk";
import { createPhishingClient } from "@mentingo/phishing-simulation-sdk";
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS, TENANT_STATUSES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { EnvService } from "src/env/services/env.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantsService } from "src/super-admin/tenants.service";

import {
  COMPETENCIES_PLUGIN_ENV_NAMES,
  INTEGRATION_KEY_ROLE_SLUG,
  PHISHING_PLUGIN_ENV_NAMES,
} from "./integration.constants";
import { IntegrationRepository } from "./integration.repository";
import { isAllowedPluginOrigin, toPluginOrigin } from "./utils/integration-plugin-origin.utils";
import { assertCanManageTenants } from "./utils/integration-tenant-access.utils";
import { withIsoAccessEndsAt } from "./utils/integration-tenant-response.utils";

import type {
  IntegrationKeyTenantContext,
  IntegrationTrainingResultsData,
  IntegrationTrainingResultsQuery,
} from "./integration.types";
import type {
  CreateIntegrationKeyResponse,
  IntegrationKeysResponse,
} from "./schemas/integration-key.schema";
import type {
  IntegrationCompetenciesConnection,
  IntegrationPluginDiscovery,
  IntegrationPhishingConnection,
  IntegrationPluginConfigured,
  IntegrationPluginStatus,
} from "./schemas/integration-plugin-connection.schema";
import type {
  IntegrationUpdateTenantApiKeysBody,
  IntegrationUpdateTenantApiKeysResponse,
} from "./schemas/integration-tenant-api-keys.schema";
import type {
  IntegrationCreateTenantBody,
  IntegrationTenantLifecycleResponse,
  IntegrationUpdateTenantBody,
} from "./schemas/integration.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class IntegrationService {
  private readonly keySecret: Buffer;

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly permissionsService: PermissionsService,
    private readonly tenantsService: TenantsService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly envService: EnvService,
    private readonly tenantDbRunner: TenantDbRunnerService,
  ) {
    if (!process.env.MASTER_KEY) throw new Error("MASTER_KEY is required for integration API keys");

    this.keySecret = Buffer.from(process.env.MASTER_KEY, "base64");
  }

  async getKeysForTenant(tenantId: string): Promise<IntegrationKeysResponse> {
    return this.integrationRepository.findActiveKeysByTenant(tenantId);
  }

  async createKeyForTenant(
    tenantId: string,
    name: string,
    creator: CurrentUserType,
  ): Promise<CreateIntegrationKeyResponse> {
    const rawKey = this.buildRawApiKey();

    const createdKey = await this.tenantDbRunner.runWithTenant(tenantId, () =>
      this.integrationRepository.createKey({
        tenantId,
        createdByUserId: creator.userId,
        name: name.trim(),
        keyPrefix: this.extractPrefix(rawKey),
        keyHash: this.hashApiKey(rawKey),
      }),
    );

    if (!createdKey)
      throw new InternalServerErrorException("integrationApiKey.errors.createFailed");

    return {
      key: rawKey,
      metadata: { ...createdKey, createdBy: { id: creator.userId, email: creator.email } },
    };
  }

  async revokeKeyForTenant(tenantId: string, keyId: string): Promise<void> {
    const revokedKey = await this.tenantDbRunner.runWithTenant(tenantId, () =>
      this.integrationRepository.revokeKey({ tenantId, keyId }),
    );

    if (!revokedKey) throw new NotFoundException("integrationApiKey.errors.notFound");
  }

  async getKeysForManagedTenant(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationKeysResponse> {
    await this.assertCanManageExistingTenant(tenantId, actor, keyTenant);

    return this.getKeysForTenant(tenantId);
  }

  async createKeyForManagedTenant(
    tenantId: string,
    name: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<CreateIntegrationKeyResponse> {
    await this.assertCanManageExistingTenant(tenantId, actor, keyTenant);

    return this.createKeyForTenant(tenantId, name, actor);
  }

  async revokeKeyForManagedTenant(
    tenantId: string,
    keyId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<void> {
    await this.assertCanManageExistingTenant(tenantId, actor, keyTenant);

    await this.revokeKeyForTenant(tenantId, keyId);
  }

  async authenticateApiKey(apiKey: string): Promise<{
    keyId: string;
    keyTenantId: string;
    keyTenantIsManaging: boolean;
    user: CurrentUserType;
  }> {
    const keyPrefix = this.extractPrefix(apiKey);

    const key = await this.integrationRepository.getActiveKeyCandidate({ keyPrefix });

    if (!key) throw new UnauthorizedException("integrationApiKey.errors.invalidApiKey");

    const hashedProvidedKey = this.hashApiKey(apiKey);

    if (!this.safeHashEqual(key.keyHash, hashedProvidedKey))
      throw new UnauthorizedException("integrationApiKey.errors.invalidApiKey");

    if (key.userDeletedAt) throw new ForbiddenException("integrationApiKey.errors.ownerInactive");

    const { keyId, keyTenantId, keyTenantIsManaging, userId, userEmail } = key;

    return {
      keyId,
      keyTenantId,
      keyTenantIsManaging,
      user: {
        userId,
        email: userEmail,
        roleSlugs: [INTEGRATION_KEY_ROLE_SLUG],
        permissions: SYSTEM_ROLE_PERMISSIONS[INTEGRATION_KEY_ROLE_SLUG],
        tenantId: keyTenantId,
      },
    };
  }

  async markKeyAsUsed(keyId: string) {
    await this.integrationRepository.markKeyAsUsed(keyId);
  }

  async getTenantsForActor(actor: CurrentUserType) {
    const currentTenant = await this.integrationRepository.getTenantById(actor.tenantId);

    if (!currentTenant) throw new UnauthorizedException("integrationApiKey.errors.invalidApiKey");

    if (!currentTenant.isManaging) {
      const { id, name, host, status, accessEndsAt } = currentTenant;

      return [withIsoAccessEndsAt({ id, name, host, status, accessEndsAt })];
    }

    const allTenants = await this.integrationRepository.getAllTenants();

    return allTenants.map(withIsoAccessEndsAt);
  }

  async createTenantForIntegration(
    input: IntegrationCreateTenantBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    assertCanManageTenants(actor, keyTenant);

    const keyTenantActor = { ...actor, tenantId: keyTenant.tenantId };

    const createdTenant = await this.tenantsService.createTenant(input, keyTenantActor, {
      actorLookupTenantId: keyTenant.tenantId,
    });

    return withIsoAccessEndsAt(createdTenant);
  }

  async deactivateTenantForIntegration(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    assertCanManageTenants(actor, keyTenant);

    const deactivatedTenant = await this.tenantsService.updateTenantById(tenantId, {
      status: TENANT_STATUSES.INACTIVE,
    });

    return withIsoAccessEndsAt(deactivatedTenant);
  }

  async deleteTenantForIntegration(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<void> {
    assertCanManageTenants(actor, keyTenant);

    await this.tenantsService.deleteTenantById(tenantId, keyTenant.tenantId);
  }

  async updateTenantForIntegration(
    tenantId: string,
    input: IntegrationUpdateTenantBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    assertCanManageTenants(actor, keyTenant);

    const updatedTenant = await this.tenantsService.updateTenantById(tenantId, input);

    return withIsoAccessEndsAt(updatedTenant);
  }

  async updateTenantApiKeysForIntegration(
    tenantId: string,
    input: IntegrationUpdateTenantApiKeysBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationUpdateTenantApiKeysResponse> {
    assertCanManageTenants(actor, keyTenant);

    const tenant = await this.integrationRepository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");

    const values = await this.envService.prepareEnvValues([
      { name: input.name, value: input.value },
    ]);
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.persistEnvValues(values, {
        ...actor,
        tenantId,
      }),
    );

    return { tenantId, updatedKeys: [input.name] };
  }

  async discoverPluginConnection(
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginDiscovery> {
    return {
      tenants: await this.getTenantsForActor({ ...actor, tenantId: keyTenant.tenantId }),
      canConfigurePlugins:
        keyTenant.isManaging && hasPermission(actor.permissions, PERMISSIONS.TENANT_MANAGE),
    };
  }

  async configurePhishingConnection(
    tenantId: string,
    input: IntegrationPhishingConnection,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginConfigured> {
    assertCanManageTenants(actor, keyTenant);
    const tenant = await this.integrationRepository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");
    const origin = await toPluginOrigin(input.baseUrl);
    const values = await this.envService.prepareEnvValues([
      { name: "PHISHING_BASE_URL", value: origin },
      { name: "PHISHING_API_KEY", value: input.apiKey },
      { name: "PHISHING_WEBHOOK_SECRET", value: input.webhookSecret },
    ]);
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.persistEnvValues(values, { ...actor, tenantId }),
    );
    return { tenantId };
  }

  async clearPhishingConnection(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginConfigured> {
    await this.assertCanManageExistingTenant(tenantId, actor, keyTenant);
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.removeEnvValues([...PHISHING_PLUGIN_ENV_NAMES], { ...actor, tenantId }),
    );
    return { tenantId };
  }

  async phishingConnectionStatus(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginStatus> {
    assertCanManageTenants(actor, keyTenant);
    if (!(await this.integrationRepository.getTenantById(tenantId)))
      throw new NotFoundException("superAdminTenants.error.notFound");
    return this.tenantDbRunner.runWithTenant(tenantId, async () => {
      try {
        const [baseUrl, apiKey, webhookSecret] = await Promise.all(
          ["PHISHING_BASE_URL", "PHISHING_API_KEY", "PHISHING_WEBHOOK_SECRET"].map((name) =>
            this.envService.getEnv(name),
          ),
        );
        if (webhookSecret.value.length < 32) return { tenantId, reachable: false, enabled: false };
        const config = await createPhishingClient({
          tenantId,
          baseURL: baseUrl.value,
          apiKey: apiKey.value,
        }).configuration.get();
        return {
          tenantId,
          reachable: true,
          enabled: config.capabilities.phishingSimulation.enabled,
        };
      } catch {
        return { tenantId, reachable: false, enabled: false };
      }
    });
  }

  async getTrainingResults(
    actor: CurrentUserType,
    query: IntegrationTrainingResultsQuery,
  ): Promise<IntegrationTrainingResultsData> {
    return this.integrationRepository.getTrainingResults(actor.tenantId, query);
  }

  async configureCompetenciesConnection(
    tenantId: string,
    input: IntegrationCompetenciesConnection,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginConfigured> {
    assertCanManageTenants(actor, keyTenant);
    if (!(await this.integrationRepository.getTenantById(tenantId)))
      throw new NotFoundException("superAdminTenants.error.notFound");
    const values = await this.envService.prepareEnvValues([
      { name: "COMPETENCIES_BASE_URL", value: input.baseUrl },
      { name: "COMPETENCIES_API_KEY", value: input.apiKey },
    ]);
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.persistEnvValues(values, { ...actor, tenantId }),
    );
    return { tenantId };
  }

  async clearCompetenciesConnection(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginConfigured> {
    await this.assertCanManageExistingTenant(tenantId, actor, keyTenant);
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.removeEnvValues([...COMPETENCIES_PLUGIN_ENV_NAMES], { ...actor, tenantId }),
    );
    return { tenantId };
  }

  async competenciesConnectionStatus(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginStatus> {
    assertCanManageTenants(actor, keyTenant);
    if (!(await this.integrationRepository.getTenantById(tenantId)))
      throw new NotFoundException("superAdminTenants.error.notFound");
    return this.tenantDbRunner.runWithTenant(tenantId, async () => {
      try {
        const [baseUrl, apiKey] = await Promise.all(
          ["COMPETENCIES_BASE_URL", "COMPETENCIES_API_KEY"].map((name) =>
            this.envService.getEnv(name),
          ),
        );
        if (!(await isAllowedPluginOrigin(baseUrl.value)))
          return { tenantId, reachable: false, enabled: false };
        const configuration = await createCompetenciesClient({
          tenantId,
          baseURL: baseUrl.value,
          apiKey: apiKey.value,
        }).configuration();
        return {
          tenantId,
          reachable: true,
          enabled: configuration.capabilities.competencies.enabled,
        };
      } catch {
        return { tenantId, reachable: false, enabled: false };
      }
    });
  }

  private async assertCanManageExistingTenant(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ) {
    assertCanManageTenants(actor, keyTenant);

    const tenant = await this.integrationRepository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");
  }

  private buildRawApiKey() {
    return `itgk_${randomBytes(32).toString("base64url")}`;
  }

  private extractPrefix(apiKey: string) {
    if (!apiKey || apiKey.length < 16)
      throw new UnauthorizedException("integrationApiKey.errors.invalidApiKey");

    return apiKey.slice(0, 16);
  }

  private hashApiKey(apiKey: string) {
    return createHmac("sha256", this.keySecret).update(apiKey, "utf8").digest("hex");
  }

  private safeHashEqual(expectedHash: string, providedHash: string) {
    const expected = Buffer.from(expectedHash, "hex");
    const provided = Buffer.from(providedHash, "hex");

    if (expected.length !== provided.length) return false;

    return timingSafeEqual(expected, provided);
  }
}
