import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { PermissionsService } from "src/permissions/permissions.service";

import { IntegrationRepository } from "./integration.repository";

import type { CurrentAdminKeyData, RotateAdminKeyData } from "./integration.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class IntegrationService {
  private readonly keySecret: Buffer;

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly permissionsService: PermissionsService,
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

    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(key.userId);

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
