import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FEATURE_SETTINGS_KEYS } from "@repo/shared";

import { REQUIRED_FEATURES_KEY } from "src/common/decorators/require-feature.decorator";
import { SettingsService } from "src/settings/settings.service";

import type { FeatureKey } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndMerge<FeatureKey[]>(REQUIRED_FEATURES_KEY, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (!requiredFeatures.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserType | undefined;

    if (!user) return false;

    const globalSettings = await this.settingsService.getGlobalSettingsByTenantId(user.tenantId);
    const disabledFeature = [...new Set(requiredFeatures)].find(
      (feature) => !this.isFeatureEnabled(globalSettings, feature),
    );

    if (disabledFeature) {
      throw new ForbiddenException("features.error.disabled");
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
}
