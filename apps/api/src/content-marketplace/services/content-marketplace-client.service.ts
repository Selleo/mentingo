import {
  createContentMarketplaceClient,
  type FileDownload,
} from "@mentingo/content-marketplace-sdk";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { EnvService } from "src/env/services/env.service";
import { isAllowedPluginOrigin } from "src/integration/utils/integration-plugin-origin.utils";
import { dbAls } from "src/storage/db/db-als.store";

import {
  CONTENT_MARKETPLACE_ENV,
  CONTENT_MARKETPLACE_ERRORS,
} from "../content-marketplace.constants";
import {
  contentMarketplaceConfigurationSchema,
  type ContentMarketplaceConfiguration,
} from "../schemas/content-marketplace-configuration.schema";
import {
  contentMarketplaceAcquisitionSchema,
  contentMarketplaceEventReceiptSchema,
  contentMarketplaceCatalogFiltersSchema,
  contentMarketplaceCatalogPageSchema,
  contentMarketplaceListingSchema,
  type ContentMarketplaceAnalyticsEvent,
  type ContentMarketplaceCatalogQuery,
} from "../schemas/content-marketplace.schema";

import type { ContentMarketplaceConnection } from "../content-marketplace.types";
import type { TSchema, Static } from "@sinclair/typebox";

/**
 * Calls the content marketplace plugin's tenant-facing API on behalf of one tenant through the
 * marketplace SDK, and checks every JSON answer against its schema before handing it on.
 */
@Injectable()
export class ContentMarketplaceClientService {
  constructor(private readonly envService: EnvService) {}

  /** The current tenant's saved plugin connection, or undefined while it is not connected. */
  async findTenantConnection(): Promise<ContentMarketplaceConnection | undefined> {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) return undefined;

    try {
      const [baseUrl, apiKey] = await Promise.all([
        this.envService.getEnv(CONTENT_MARKETPLACE_ENV.BASE_URL),
        this.envService.getEnv(CONTENT_MARKETPLACE_ENV.API_KEY),
      ]);

      return { baseUrl: baseUrl.value, apiKey: apiKey.value, tenantId };
    } catch {
      return undefined;
    }
  }

  async fetchConfiguration(
    connection: ContentMarketplaceConnection,
  ): Promise<ContentMarketplaceConfiguration> {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.configuration.get(),
      contentMarketplaceConfigurationSchema,
    );
  }

  async listCatalogPage(
    connection: ContentMarketplaceConnection,
    query: ContentMarketplaceCatalogQuery,
  ) {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.catalog.list(query),
      contentMarketplaceCatalogPageSchema,
    );
  }

  async listCatalogFilters(connection: ContentMarketplaceConnection) {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.catalog.filters(),
      contentMarketplaceCatalogFiltersSchema,
    );
  }

  async getListing(connection: ContentMarketplaceConnection, listingId: string) {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.listings.get(listingId),
      contentMarketplaceListingSchema,
    );
  }

  async openListingThumbnail(
    connection: ContentMarketplaceConnection,
    listingId: string,
  ): Promise<FileDownload> {
    const client = await this.createTenantMarketplaceClient(connection);

    return client.listings.thumbnail(listingId);
  }

  async createAcquisition(connection: ContentMarketplaceConnection, listingId: string) {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.acquisitions.create(listingId),
      contentMarketplaceAcquisitionSchema,
    );
  }

  async openAcquisitionArchive(
    connection: ContentMarketplaceConnection,
    acquisitionId: string,
  ): Promise<FileDownload> {
    const client = await this.createTenantMarketplaceClient(connection);

    return client.acquisitions.archive(acquisitionId);
  }

  async sendEvent(
    connection: ContentMarketplaceConnection,
    event: ContentMarketplaceAnalyticsEvent,
  ) {
    const client = await this.createTenantMarketplaceClient(connection);

    return this.readValidatedMarketplaceResponse(
      client.events.send(event),
      contentMarketplaceEventReceiptSchema,
    );
  }

  private async createTenantMarketplaceClient(connection: ContentMarketplaceConnection) {
    if (!(await isAllowedPluginOrigin(connection.baseUrl)))
      throw new ForbiddenException(CONTENT_MARKETPLACE_ERRORS.UNAVAILABLE);

    return createContentMarketplaceClient({
      apiKey: connection.apiKey,
      baseURL: connection.baseUrl,
      tenantId: connection.tenantId,
    });
  }

  private async readValidatedMarketplaceResponse<Schema extends TSchema>(
    response: Promise<unknown>,
    schema: Schema,
  ): Promise<Static<Schema>> {
    const data = await response;

    if (!Value.Check(schema, data))
      throw new Error("Content marketplace returned an unexpected response");

    return data;
  }
}
