import { CompetenciesApiError, createCompetenciesClient } from "@mentingo/competencies-sdk";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";

import { EnvService } from "src/env/services/env.service";
import { isAllowedPluginOrigin } from "src/integration/utils/integration-plugin-origin.utils";
import { dbAls } from "src/storage/db/db-als.store";

@Injectable()
export class CompetenciesClientService {
  constructor(private readonly envService: EnvService) {}
  async isConfigured() {
    if (!dbAls.getStore()?.tenantId) return false;
    const values = await Promise.all(
      ["COMPETENCIES_API_KEY", "COMPETENCIES_BASE_URL"].map(async (name) => {
        try {
          return (await this.envService.getEnv(name)).value;
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
          return undefined;
        }
      }),
    );
    return values.every((value) => Boolean(value?.trim()));
  }
  async client() {
    const tenantId = dbAls.getStore()?.tenantId;
    const [apiKey, baseURL] = await Promise.all(
      ["COMPETENCIES_API_KEY", "COMPETENCIES_BASE_URL"].map(async (name) => {
        try {
          return (await this.envService.getEnv(name)).value;
        } catch {
          return undefined;
        }
      }),
    );
    if (!tenantId || !apiKey || !baseURL) throw new ForbiddenException("competencies.unavailable");
    if (!(await isAllowedPluginOrigin(baseURL)))
      throw new ForbiddenException("competencies.unavailable");
    return createCompetenciesClient({ tenantId, apiKey, baseURL });
  }
  async run<T>(
    operation: (client: ReturnType<typeof createCompetenciesClient>) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(await this.client());
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof CompetenciesApiError) {
        if (error.status === 400) throw new BadRequestException("competencies.invalidRequest");
        if (error.status === 413) throw new PayloadTooLargeException("competencies.invalidRequest");
        if (error.status === 404) throw new NotFoundException("competencies.notFound");
        if (error.status === 409) throw new ConflictException("competencies.conflict");
        if (error.status === 401 || error.status === 403)
          throw new ForbiddenException("competencies.unavailable");
      }
      throw new BadGatewayException("competencies.serviceError");
    }
  }
}
