import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FEATURE_SETTINGS_KEYS, FEATURE_UNREGISTERED_ACCESS_KEYS } from "@repo/shared";

import { REQUIRED_FEATURES_KEY } from "src/common/decorators/require-feature.decorator";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import type { FeatureKey, UnregisteredAccessFeatureKey } from "@repo/shared";
import type { RequireFeatureConfig } from "src/common/decorators/require-feature.decorator";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
    private readonly tenantDbRunner: TenantDbRunnerService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<RequireFeatureConfig>(
      REQUIRED_FEATURES_KEY,
      [context.getClass(), context.getHandler()],
    );
    if (!requiredFeatures) return true;
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

    const { features, allowUnregisteredUser } = requiredFeatures;
    const disabledFeature = features.find((feature) => {
      const isEnabled = this.isFeatureEnabled(globalSettings, feature);

      if (!isEnabled) return true;
      if (user) return false;
      if (allowUnregisteredUser) return !this.isUnregisteredAccessAllowed(globalSettings, feature);

      return true;
    });

    if (disabledFeature) {
      throw new BadRequestException("common.toast.noAccess");
    }

    return true;
  }

  private isFeatureEnabled(
    settings: GlobalSettingsJSONContentSchema,
    feature: FeatureKey,
  ): boolean {
    const settingKey = FEATURE_SETTINGS_KEYS[feature];
    return Boolean(settings[settingKey]);
  }

  private isUnregisteredAccessAllowed(
    settings: GlobalSettingsJSONContentSchema,
    feature: FeatureKey,
  ): boolean {
    if (!this.hasUnregisteredAccessSetting(feature)) return false;

    const settingKey = FEATURE_UNREGISTERED_ACCESS_KEYS[feature];
    return Boolean(settings[settingKey]);
  }

  private hasUnregisteredAccessSetting = (
    feature: FeatureKey,
  ): feature is UnregisteredAccessFeatureKey => feature in FEATURE_UNREGISTERED_ACCESS_KEYS;
}
