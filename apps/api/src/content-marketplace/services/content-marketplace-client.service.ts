import {
  createContentMarketplaceClient,
  type FileDownload,
} from "@mentingo/content-marketplace-sdk";
import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import { CONTENT_MARKETPLACE_ENV } from "../content-marketplace.constants";
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

  fetchConfiguration(
    connection: ContentMarketplaceConnection,
  ): Promise<ContentMarketplaceConfiguration> {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).configuration.get(),
      contentMarketplaceConfigurationSchema,
    );
  }

  listCatalogPage(connection: ContentMarketplaceConnection, query: ContentMarketplaceCatalogQuery) {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).catalog.list(query),
      contentMarketplaceCatalogPageSchema,
    );
  }

  listCatalogFilters(connection: ContentMarketplaceConnection) {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).catalog.filters(),
      contentMarketplaceCatalogFiltersSchema,
    );
  }

  getListing(connection: ContentMarketplaceConnection, listingId: string) {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).listings.get(listingId),
      contentMarketplaceListingSchema,
    );
  }

  openListingThumbnail(
    connection: ContentMarketplaceConnection,
    listingId: string,
  ): Promise<FileDownload> {
    return this.createTenantMarketplaceClient(connection).listings.thumbnail(listingId);
  }

  createAcquisition(connection: ContentMarketplaceConnection, listingId: string) {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).acquisitions.create(listingId),
      contentMarketplaceAcquisitionSchema,
    );
  }

  openAcquisitionArchive(
    connection: ContentMarketplaceConnection,
    acquisitionId: string,
  ): Promise<FileDownload> {
    return this.createTenantMarketplaceClient(connection).acquisitions.archive(acquisitionId);
  }

  sendEvent(connection: ContentMarketplaceConnection, event: ContentMarketplaceAnalyticsEvent) {
    return this.readValidatedMarketplaceResponse(
      this.createTenantMarketplaceClient(connection).events.send(event),
      contentMarketplaceEventReceiptSchema,
    );
  }

  private createTenantMarketplaceClient(connection: ContentMarketplaceConnection) {
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
