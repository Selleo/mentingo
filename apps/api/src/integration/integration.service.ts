import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

import { createPhishingClient } from "@mentingo/phishing";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PERMISSIONS, TENANT_STATUSES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { EnvService } from "src/env/services/env.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantsService } from "src/super-admin/tenants.service";

import { IntegrationRepository } from "./integration.repository";

import type {
  CurrentAdminKeyData,
  IntegrationKeyTenantContext,
  IntegrationTrainingResultsData,
  IntegrationTrainingResultsQuery,
  RotateAdminKeyData,
} from "./integration.types";
import type {
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

  async getCurrentAdminKey(userId: string): Promise<CurrentAdminKeyData> {
    const key = await this.integrationRepository.getCurrentActiveKeyByCreator(userId);

    return {
      key,
    };
  }

  async rotateAdminKey(actor: CurrentUserType): Promise<RotateAdminKeyData> {
    const rawKey = this.buildRawApiKey();
    const keyPrefix = this.extractPrefix(rawKey);
    const keyHash = this.hashApiKey(rawKey);

    const createdKey = await this.integrationRepository.rotateAdminKey({
      userId: actor.userId,
      tenantId: actor.tenantId,
      keyPrefix,
      keyHash,
    });

    if (!createdKey)
      throw new InternalServerErrorException("integrationApiKey.errors.rotateFailed");

    return {
      key: rawKey,
      metadata: createdKey,
    };
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

    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(
      key.userId,
      this.dbAdmin,
    );

    if (!permissions.includes(PERMISSIONS.INTEGRATION_API_USE)) {
      throw new ForbiddenException("integrationApiKey.errors.ownerNotAdmin");
    }

    const { keyId, keyTenantId, keyTenantIsManaging, userId, userEmail } = key;

    return {
      keyId,
      keyTenantId,
      keyTenantIsManaging,
      user: {
        userId,
        email: userEmail,
        roleSlugs,
        permissions,
        tenantId: keyTenantId,
      },
    };
  }

  async markKeyAsUsed(keyId: string) {
    await this.integrationRepository.markKeyAsUsed(keyId);
  }

  async getAllTenants() {
    return this.integrationRepository.getAllTenants();
  }

  async getTenantsForActor(actor: CurrentUserType) {
    const currentTenant = await this.integrationRepository.getTenantById(actor.tenantId);

    if (!currentTenant) throw new UnauthorizedException("integrationApiKey.errors.invalidApiKey");

    if (!currentTenant.isManaging) {
      return [
        {
          id: currentTenant.id,
          name: currentTenant.name,
          host: currentTenant.host,
        },
      ];
    }

    return this.integrationRepository.getAllTenants();
  }

  async createTenantForIntegration(
    input: IntegrationCreateTenantBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    this.assertCanManageTenants(actor, keyTenant);

    const keyTenantActor = { ...actor, tenantId: keyTenant.tenantId };

    return this.tenantsService.createTenant(input, keyTenantActor, {
      actorLookupTenantId: keyTenant.tenantId,
    });
  }

  async deactivateTenantForIntegration(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    this.assertCanManageTenants(actor, keyTenant);

    return this.tenantsService.updateTenantById(tenantId, {
      status: TENANT_STATUSES.INACTIVE,
    });
  }

  async deleteTenantForIntegration(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<void> {
    this.assertCanManageTenants(actor, keyTenant);

    await this.tenantsService.deleteTenantById(tenantId, keyTenant.tenantId);
  }

  async updateTenantForIntegration(
    tenantId: string,
    input: IntegrationUpdateTenantBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationTenantLifecycleResponse> {
    this.assertCanManageTenants(actor, keyTenant);

    return this.tenantsService.updateTenantById(tenantId, input);
  }

  async updateTenantApiKeysForIntegration(
    tenantId: string,
    input: IntegrationUpdateTenantApiKeysBody,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationUpdateTenantApiKeysResponse> {
    this.assertCanManageTenants(actor, keyTenant);

    const tenant = await this.integrationRepository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");

    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.bulkUpsertEnv([{ name: input.name, value: input.value }], {
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
    this.assertCanManageTenants(actor, keyTenant);
    const tenant = await this.integrationRepository.getTenantById(tenantId);
    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");
    let url: URL;
    try {
      url = new URL(input.baseUrl);
    } catch {
      throw new BadRequestException("Invalid plugin URL");
    }
    const local =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(url.protocol === "https:" || (local && url.protocol === "http:"))
    ) {
      throw new BadRequestException(
        "Use an HTTPS plugin origin (HTTP localhost is allowed in development)",
      );
    }
    await this.tenantDbRunner.runWithTenantTransaction(tenantId, () =>
      this.envService.bulkUpsertEnv(
        [
          { name: "PHISHING_BASE_URL", value: url.origin },
          { name: "PHISHING_API_KEY", value: input.apiKey },
          { name: "PHISHING_WEBHOOK_SECRET", value: input.webhookSecret },
        ],
        { ...actor, tenantId },
      ),
    );
    return { tenantId };
  }

  async phishingConnectionStatus(
    tenantId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationPluginStatus> {
    this.assertCanManageTenants(actor, keyTenant);
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

  private assertCanManageTenants(actor: CurrentUserType, keyTenant: IntegrationKeyTenantContext) {
    if (!hasPermission(actor.permissions, PERMISSIONS.TENANT_MANAGE)) {
      throw new NotFoundException("auth.error.missingPermission");
    }

    if (!keyTenant.isManaging) {
      throw new NotFoundException("superAdminTenants.error.managingTenantRequired");
    }
  }
}
