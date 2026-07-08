import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ENTITY_TYPES_KEYS, UNREGISTERED_ACCESS_KEYS } from "@repo/shared";

import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { REQUIRED_ENTITY_TYPES_KEY } from "../decorators/require-entity-type.decorator";

import type { CurrentUserType } from "../types/current-user.type";
import type { FeatureFlaggedEntityType, UnregisteredAccessEntityType } from "@repo/shared";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

@Injectable()
export class EntityTypesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
    private readonly tenantDbRunner: TenantDbRunnerService,
    private readonly tenantResolver: TenantResolverService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredEntityType = this.reflector.getAllAndMerge<FeatureFlaggedEntityType[]>(
      REQUIRED_ENTITY_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredEntityType.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserType | undefined;

    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic && !user) return false;

    const tenantId = await this.tenantResolver.resolveTenantId(request);

    if (!tenantId) throw new UnauthorizedException("Missing tenantId");

    const globalSettings = await this.tenantDbRunner.runWithTenant(tenantId, () =>
      this.settingsService.getGlobalSettings(),
    );

    const disabledEntityTypes = [...new Set(requiredEntityType)].find((entityType) => {
      const isEnabled = this.isEntityTypeEnabled(globalSettings, entityType);

      if (!isEnabled) return true;

      if (user) return false;

      return !this.isUnregisteredAccessAllowed(globalSettings, entityType);
    });
    if (disabledEntityTypes) {
      throw new ForbiddenException("common.toast.noAccess");
    }

    return true;
  }

  private isEntityTypeEnabled(
    settings: GlobalSettingsJSONContentSchema,
    entityType: FeatureFlaggedEntityType,
  ): boolean {
    const settingKey = ENTITY_TYPES_KEYS[entityType];

    return Boolean(settings[settingKey]);
  }

  private isUnregisteredAccessAllowed(
    settings: GlobalSettingsJSONContentSchema,
    entityType: FeatureFlaggedEntityType,
  ): boolean {
    const settingKey = UNREGISTERED_ACCESS_KEYS[entityType as UnregisteredAccessEntityType];

    if (!settingKey) return false;

    return Boolean(settings[settingKey]);
  }
}
