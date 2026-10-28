import { GuideApiError } from "@mentingo/guide-sdk";
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";

import { readHelpdeskDomains, readHelpdeskSearch, readHelpdeskTutorial } from "./helpdesk-response";
import { HELPDESK_CLIENT, HELPDESK_TIMEOUT_MS } from "./helpdesk.types";

import type { HelpdeskSdkClient } from "./helpdesk.types";
import type {
  HelpdeskDomainsResponse,
  HelpdeskSearchResponse,
  HelpdeskTutorialResponse,
} from "./schemas/helpdesk.schema";
import type { GuideTutorialQuery, SearchRequest } from "@mentingo/guide-sdk";

@Injectable()
export class HelpdeskClientService {
  constructor(
    @Inject(HELPDESK_CLIENT) private readonly helpdeskSdkClient: HelpdeskSdkClient | null,
  ) {}

  search(input: SearchRequest): Promise<HelpdeskSearchResponse> {
    return this.run(async (client) =>
      readHelpdeskSearch(await client.search.query(input, this.requestOptions())),
    );
  }

  getTutorial(key: string, query: GuideTutorialQuery): Promise<HelpdeskTutorialResponse> {
    return this.run(
      async (client) =>
        readHelpdeskTutorial(await client.tutorials.get(key, query, this.requestOptions())),
      true,
    );
  }

  getDomains(): Promise<HelpdeskDomainsResponse> {
    return this.run(async (client) =>
      readHelpdeskDomains(await client.tutorials.domains(this.requestOptions())),
    );
  }

  private requestOptions() {
    return { signal: AbortSignal.timeout(HELPDESK_TIMEOUT_MS) };
  }

  /** Translate upstream failures without forwarding provider text, URLs, or request details. */
  private async run<T>(
    operation: (client: HelpdeskSdkClient) => Promise<T>,
    allowNotFound = false,
  ): Promise<T> {
    if (!this.helpdeskSdkClient) {
      throw new ServiceUnavailableException({
        message: "helpdesk.errors.disabled",
        retryable: false,
      });
    }

    try {
      return await operation(this.helpdeskSdkClient);
    } catch (error: unknown) {
      if (allowNotFound && error instanceof GuideApiError && error.status === 404) {
        throw new NotFoundException("helpdesk.errors.notFound");
      }

      const retryAfter = error instanceof GuideApiError ? error.retryAfter : undefined;
      const retryAfterSeconds =
        retryAfter && /^\d{1,9}$/.test(retryAfter) ? Math.min(Number(retryAfter), 60) : undefined;
      throw new ServiceUnavailableException({
        message: "helpdesk.errors.unavailable",
        retryable: error instanceof GuideApiError ? error.retryable : true,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      });
    }
  }
}
