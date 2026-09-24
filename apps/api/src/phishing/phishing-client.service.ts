import { createPhishingClient, PhishingApiError } from "@mentingo/phishing";
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";

import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";
@Injectable()
export class PhishingClientService {
  constructor(private readonly env: EnvService) {}
  async secret(name: string) {
    return this.env
      .getEnv(name)
      .then(({ value }) => value)
      .catch(() => process.env[name]);
  }
  async client() {
    const tenantId = dbAls.getStore()?.tenantId;
    const [apiKey, baseURL, webhookSecret] = await Promise.all([
      this.secret("PHISHING_API_KEY"),
      this.secret("PHISHING_BASE_URL"),
      this.secret("PHISHING_WEBHOOK_SECRET"),
    ]);
    if (!tenantId || !apiKey || !baseURL || !webhookSecret || webhookSecret.length < 32)
      throw new ForbiddenException("phishing.unavailable");
    return createPhishingClient({ tenantId, apiKey, baseURL });
  }
  async run<T>(fn: (client: ReturnType<typeof createPhishingClient>) => Promise<T>): Promise<T> {
    const client = await this.client();
    try {
      if (!(await client.configuration.get()).capabilities.phishingSimulation.enabled)
        throw new ForbiddenException("phishing.unavailable");
      return await fn(client);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof PhishingApiError) {
        if (error.status === 404) throw new NotFoundException("phishing.notFound");
        if (error.status === 409) throw new ConflictException("phishing.conflict");
        if (error.status === 403) throw new ForbiddenException("phishing.unavailable");
      }
      throw new BadGatewayException("phishing.serviceError");
    }
  }
}
