import { createCompetenciesClient } from "@mentingo/competencies-sdk";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { COMPETENCIES_SECRETS } from "src/env/env.config";
import { EnvService } from "src/env/services/env.service";
import { isAllowedPluginOrigin } from "src/integration/utils/integration-plugin-origin.utils";
import { dbAls } from "src/storage/db/db-als.store";

import { translateCompetenciesClientError } from "./utils/competencies-client-error.utils";

import type { CompetenciesClient, CompetenciesConnectionSettings } from "./competencies.types";

@Injectable()
export class CompetenciesClientService {
  constructor(private readonly envService: EnvService) {}

  async isConfigured(): Promise<boolean> {
    if (!dbAls.getStore()?.tenantId) return false;
    const { apiKey, baseURL } = await this.readConnectionSettings();
    return Boolean(apiKey?.trim() && baseURL?.trim());
  }

  async createTenantClient(): Promise<CompetenciesClient> {
    const tenantId = dbAls.getStore()?.tenantId;
    if (!tenantId) throw new ForbiddenException("competencies.unavailable");

    const { apiKey, baseURL } = await this.readConnectionSettings().catch(() => {
      throw new ForbiddenException("competencies.unavailable");
    });

    if (!apiKey || !baseURL || !(await isAllowedPluginOrigin(baseURL)))
      throw new ForbiddenException("competencies.unavailable");

    return createCompetenciesClient({ tenantId, apiKey, baseURL });
  }

  async requestWithClient<T>(request: (client: CompetenciesClient) => Promise<T>): Promise<T> {
    try {
      return await request(await this.createTenantClient());
    } catch (error) {
      throw translateCompetenciesClientError(error);
    }
  }

  private async readConnectionSettings(): Promise<CompetenciesConnectionSettings> {
    const [apiKey, baseURL] = await Promise.all([
      this.readOptionalSecret(COMPETENCIES_SECRETS.API_KEY),
      this.readOptionalSecret(COMPETENCIES_SECRETS.BASE_URL),
    ]);
    return { apiKey, baseURL };
  }

  private async readOptionalSecret(name: string): Promise<string | undefined> {
    try {
      return (await this.envService.getEnv(name)).value;
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      return undefined;
    }
  }
}
