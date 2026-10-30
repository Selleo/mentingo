import { createPhishingClient, PhishingApiError } from "@mentingo/phishing-simulation-sdk";
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { match } from "ts-pattern";

import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import {
  PHISHING_ENV_KEYS,
  PHISHING_WEBHOOK_SECRET_MIN_LENGTH,
} from "../constants/phishing.constants";
import { isSignedByPhishingPlugin } from "../utils/phishing-webhook.utils";

import type { PhishingEnvKey } from "../constants/phishing.constants";
import type { PhishingClient, SignedPhishingRequest } from "../types/phishing.types";

@Injectable()
export class PhishingClientService {
  constructor(private readonly envService: EnvService) {}

  /** Reads a tenant phishing setting, falling back to the process environment. */
  async readPhishingSetting(name: PhishingEnvKey) {
    return this.envService
      .getEnv(name)
      .then(({ value }) => value)
      .catch(() => process.env[name]);
  }

  /** Rejects callbacks not signed with the current tenant's webhook secret; call inside a tenant context. */
  async assertSignedByPhishingPlugin(request: SignedPhishingRequest) {
    const secret = await this.readPhishingSetting(PHISHING_ENV_KEYS.WEBHOOK_SECRET);

    if (!isSignedByPhishingPlugin(request, secret))
      throw new UnauthorizedException("phishing.unavailable");
  }

  /**
   * Calls the tenant's phishing plugin once simulations are enabled for it, and maps plugin
   * failures to translated HTTP errors.
   */
  async callPhishingPlugin<T>(
    requestFromPlugin: (client: PhishingClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.createTenantPhishingClient();

    try {
      await this.assertPhishingSimulationEnabled(client);
      return await requestFromPlugin(client);
    } catch (error) {
      throw this.toPhishingHttpException(error);
    }
  }

  private async createTenantPhishingClient() {
    const tenantId = dbAls.getStore()?.tenantId;

    const [apiKey, baseURL, webhookSecret] = await Promise.all([
      this.readPhishingSetting(PHISHING_ENV_KEYS.API_KEY),
      this.readPhishingSetting(PHISHING_ENV_KEYS.BASE_URL),
      this.readPhishingSetting(PHISHING_ENV_KEYS.WEBHOOK_SECRET),
    ]);

    if (
      !tenantId ||
      !apiKey ||
      !baseURL ||
      !webhookSecret ||
      webhookSecret.length < PHISHING_WEBHOOK_SECRET_MIN_LENGTH
    )
      throw new ForbiddenException("phishing.unavailable");

    return createPhishingClient({ tenantId, apiKey, baseURL });
  }

  private async assertPhishingSimulationEnabled(client: PhishingClient) {
    const configuration = await client.configuration.get();

    if (!configuration.capabilities.phishingSimulation.enabled)
      throw new ForbiddenException("phishing.unavailable");
  }

  private toPhishingHttpException(error: unknown) {
    if (error instanceof ForbiddenException) return error;
    if (!(error instanceof PhishingApiError))
      return new BadGatewayException("phishing.serviceError");

    return match(error.status)
      .with(HttpStatus.NOT_FOUND, () => new NotFoundException("phishing.notFound"))
      .with(HttpStatus.CONFLICT, () => new ConflictException("phishing.conflict"))
      .with(HttpStatus.FORBIDDEN, () => new ForbiddenException("phishing.unavailable"))
      .otherwise(() => new BadGatewayException("phishing.serviceError"));
  }
}
