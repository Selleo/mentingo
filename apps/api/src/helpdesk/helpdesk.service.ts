import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { FEATURES, FEATURE_SETTINGS_KEYS } from "@repo/shared";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import helpdeskConfig, { HelpdeskConfig } from "src/common/configuration/helpdesk";
import { SettingsService } from "src/settings/settings.service";

import { HelpdeskClientService } from "./helpdesk-client.service";
import { resolveHelpdeskAppVersion } from "./helpdesk-context";
import {
  helpdeskSearchRequestSchema,
  helpdeskTutorialKeySchema,
  helpdeskTutorialQuerySchema,
} from "./schemas/helpdesk.schema";

import type {
  HelpdeskDomainsResponse,
  HelpdeskSearchRequest,
  HelpdeskSearchResponse,
  HelpdeskTutorialQuery,
  HelpdeskTutorialResponse,
} from "./schemas/helpdesk.schema";

const searchValidator = TypeCompiler.Compile(helpdeskSearchRequestSchema);
const tutorialKeyValidator = TypeCompiler.Compile(helpdeskTutorialKeySchema);
const tutorialQueryValidator = TypeCompiler.Compile(helpdeskTutorialQuerySchema);

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly helpdeskClientService: HelpdeskClientService,
    private readonly settingsService: SettingsService,
    @Inject(helpdeskConfig.KEY) private readonly config: HelpdeskConfig,
  ) {}

  /** Send only explicit search text and public compatibility context to the shared catalog. */
  async search(input: HelpdeskSearchRequest): Promise<HelpdeskSearchResponse> {
    if (!searchValidator.Check(input) || Buffer.byteLength(input.query, "utf8") > 1_000) {
      throw new BadRequestException("helpdesk.errors.invalidRequest");
    }
    const context = await this.compatibilityContext();
    return this.helpdeskClientService.search({
      query: input.query,
      language: input.language,
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.pageKey ? { pageKey: input.pageKey } : {}),
      ...(input.domain ? { domain: input.domain } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...context,
    });
  }

  /** Detail lookup uses the same tenant compatibility context as search, including deep links. */
  async getTutorial(key: string, query: HelpdeskTutorialQuery): Promise<HelpdeskTutorialResponse> {
    if (!tutorialKeyValidator.Check(key) || !tutorialQueryValidator.Check(query)) {
      throw new BadRequestException("helpdesk.errors.invalidRequest");
    }
    const { appVersion, features } = await this.compatibilityContext();
    return this.helpdeskClientService.getTutorial(key, {
      language: query.language,
      appVersion,
      ...(features.length ? { features: features.join(",") } : {}),
    });
  }

  getDomains(): Promise<HelpdeskDomainsResponse> {
    this.requireEnabled();
    return this.helpdeskClientService.getDomains();
  }

  private requireEnabled(): void {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException({
        message: "helpdesk.errors.disabled",
        retryable: false,
      });
    }
  }

  private async compatibilityContext() {
    this.requireEnabled();
    const appVersion = resolveHelpdeskAppVersion(this.config.appVersion);
    const settings = await this.settingsService.getGlobalSettings();
    const features = Object.values(FEATURES).filter(
      (feature) => settings[FEATURE_SETTINGS_KEYS[feature]] === true,
    );
    return { appVersion, features };
  }
}
