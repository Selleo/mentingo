import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { LOGIN_METHOD_ERROR_KEYS, LOGIN_METHODS, OAUTH_LOGIN_METHODS } from "@repo/shared";

import { LOGIN_METHOD_ENV_KEYS } from "src/env/login-methods.constants";
import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { LoginMethod } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  BulkUpsertEnvBody,
  LoginMethodSetupResponse,
  LoginMethodsResponse,
  UpdateLoginMethodBody,
} from "src/env/env.schema";

@Injectable()
export class LoginMethodsService {
  constructor(
    private readonly envService: EnvService,
    private readonly envRepository: EnvRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async getLoginMethods(): Promise<LoginMethodsResponse> {
    const enabledLoginMethods = await Promise.all(
      Object.values(LOGIN_METHODS).map(
        async (method) => [method, await this.isLoginMethodEnabled(method)] as const,
      ),
    );

    return Object.fromEntries(enabledLoginMethods) as LoginMethodsResponse;
  }

  async getLoginMethodSetup(): Promise<LoginMethodSetupResponse> {
    const [methods, google, microsoft, slack] = await Promise.all([
      this.getLoginMethods(),
      this.getMissingCredentials(OAUTH_LOGIN_METHODS.GOOGLE),
      this.getMissingCredentials(OAUTH_LOGIN_METHODS.MICROSOFT),
      this.getMissingCredentials(OAUTH_LOGIN_METHODS.SLACK),
    ]);

    return { methods, missingCredentials: { google, microsoft, slack } };
  }

  async assertLoginMethodEnabled(method: LoginMethod) {
    if (!(await this.isLoginMethodEnabled(method))) {
      throw new UnauthorizedException(LOGIN_METHOD_ERROR_KEYS.DISABLED);
    }
  }

  /**
   * Turns a login method on or off. Provider credentials are managed on the environment page;
   * enabling a provider without them is rejected. Updates are serialized per tenant by locking the
   * global settings row, so two admins disabling different methods at once cannot leave the
   * organization without a way to log in.
   */
  async updateLoginMethod({ method, enabled }: UpdateLoginMethodBody, actor: CurrentUserType) {
    await this.tenantDbRunnerService.transaction(async () => {
      const globalSettings = await this.envRepository.findGlobalSettingsForUpdate();

      if (enabled) {
        await this.assertCredentialsConfigured(method);
      } else {
        await this.assertAnotherLoginMethodRemainsUsable(method, globalSettings?.enforceSSO);
      }

      await this.envService.bulkUpsertInternalEnv(this.buildEnabledFlags(method, enabled), actor);
    });
  }

  private async assertCredentialsConfigured(method: LoginMethod) {
    const missingCredentials = await this.getMissingCredentials(method);

    if (missingCredentials.length) {
      throw new BadRequestException(LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION);
    }
  }

  private async assertAnotherLoginMethodRemainsUsable(
    disabledMethod: LoginMethod,
    enforceSSO = false,
  ) {
    const remainingMethods = Object.values(LOGIN_METHODS).filter(
      (method) => method !== disabledMethod,
    );
    const remainingMethodsUsability = await Promise.all(
      remainingMethods.map((method) => this.isLoginMethodUsable(method, enforceSSO)),
    );

    if (!remainingMethodsUsability.some(Boolean)) {
      throw new BadRequestException(LOGIN_METHOD_ERROR_KEYS.LAST_METHOD);
    }
  }

  private async isLoginMethodUsable(method: LoginMethod, enforceSSO: boolean) {
    const isBlockedBySSOEnforcement = enforceSSO && method === LOGIN_METHODS.PASSWORD;

    if (isBlockedBySSOEnforcement || !(await this.isLoginMethodEnabled(method))) return false;

    const missingCredentials = await this.getMissingCredentials(method);

    return missingCredentials.length === 0;
  }

  private async isLoginMethodEnabled(method: LoginMethod) {
    const { enabledFlag, enabledByDefault } = LOGIN_METHOD_ENV_KEYS[method];
    const enabledFlagValue = await this.getSecretOrProcessEnv(enabledFlag);

    if (enabledFlagValue === undefined) return enabledByDefault;

    return enabledFlagValue === "true";
  }

  private async getMissingCredentials(method: LoginMethod) {
    const { credentials } = LOGIN_METHOD_ENV_KEYS[method];
    const credentialValues = await Promise.all(
      credentials.map((key) => this.getSecretOrProcessEnv(key)),
    );

    return credentials.filter((_key, index) => !credentialValues[index]?.trim());
  }

  private buildEnabledFlags(method: LoginMethod, enabled: boolean): BulkUpsertEnvBody {
    const { enabledFlag, publicEnabledFlag } = LOGIN_METHOD_ENV_KEYS[method];
    const flagKeys = publicEnabledFlag ? [enabledFlag, publicEnabledFlag] : [enabledFlag];

    return flagKeys.map((name) => ({ name, value: String(enabled) }));
  }

  /**
   * Falls back to the process environment only when the tenant has no stored secret.
   * Any other storage failure is rethrown so login method checks fail closed.
   */
  private async getSecretOrProcessEnv(key: string) {
    try {
      const { value } = await this.envService.getEnv(key);

      return value;
    } catch (error) {
      if (error instanceof NotFoundException) return process.env[key];

      throw error;
    }
  }
}
