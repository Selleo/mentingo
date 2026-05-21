import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";

@Injectable()
export class LearningPathsEnabledGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = await this.tenantResolver.resolveTenantId(request);

    if (!tenantId) throw new UnauthorizedException("Missing tenantId");

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const globalSettings = await this.settingsService.getGlobalSettings();

      if (!globalSettings.learningPathsEnabled) {
        throw new ForbiddenException(LEARNING_PATH_ERRORS.FEATURE_DISABLED);
      }
    });

    return true;
  }
}
