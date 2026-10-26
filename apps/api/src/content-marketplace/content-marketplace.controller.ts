import { Readable } from "node:stream";

import { Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiProduces } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  PaginatedResponse,
  paginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { ApiEndpointDocs } from "src/common/decorators/api-endpoint-docs.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  CONTENT_MARKETPLACE_CATALOG_DEFAULTS,
  CONTENT_MARKETPLACE_THUMBNAIL_FALLBACK_CONTENT_TYPE,
} from "./content-marketplace.constants";
import {
  contentMarketplaceAvailabilitySchema,
  contentMarketplaceCatalogFiltersSchema,
  contentMarketplaceCatalogQuerySchema,
  contentMarketplaceCopySchema,
  contentMarketplaceTenantListingSchema,
  contentMarketplaceTenantListingsSchema,
} from "./schemas/content-marketplace.schema";
import { ContentMarketplaceService } from "./services/content-marketplace.service";

import type { ContentMarketplaceSort, ContentMarketplaceDuration } from "@repo/shared";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

const catalogQuery = contentMarketplaceCatalogQuerySchema.properties;

@Controller("content-marketplace")
@UseGuards(PermissionsGuard)
export class ContentMarketplaceController {
  constructor(private readonly contentMarketplaceService: ContentMarketplaceService) {}

  @Get("configuration")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "Check whether the content marketplace is available",
    description:
      "Reports whether the current tenant is connected to the content marketplace and has it enabled. Never fails because the marketplace is unreachable.",
  })
  @Validate({ response: baseResponse(contentMarketplaceAvailabilitySchema) })
  async getContentMarketplaceAvailability() {
    return new BaseResponse(await this.contentMarketplaceService.getAvailability());
  }

  @Get("filter-options")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "List content marketplace filter options",
    description: "Returns the categories of the published courses, for the catalog filters.",
  })
  @Validate({ response: baseResponse(contentMarketplaceCatalogFiltersSchema) })
  async getContentMarketplaceFilterOptions() {
    return new BaseResponse(await this.contentMarketplaceService.listCatalogFilters());
  }

  @Get("listings")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "Browse content marketplace courses",
    description:
      "Search, filter and sort published courses and return one page with its total count. Each listing says which course the tenant copied it into, if any, and whether a newer version is available.",
  })
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: catalogQuery.keyword },
      { type: "query", name: "category", schema: catalogQuery.category },
      { type: "query", name: "duration", schema: catalogQuery.duration },
      { type: "query", name: "sortBy", schema: catalogQuery.sortBy },
      { type: "query", name: "page", schema: catalogQuery.page },
      { type: "query", name: "perPage", schema: catalogQuery.perPage },
    ],
    response: paginatedResponse(contentMarketplaceTenantListingsSchema),
  })
  async listContentMarketplaceListings(
    @Query("keyword") keyword: string | undefined,
    @Query("category") category: string | undefined,
    @Query("duration") duration: ContentMarketplaceDuration | undefined,
    @Query("sortBy") sortBy: ContentMarketplaceSort | undefined,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
  ) {
    return new PaginatedResponse(
      await this.contentMarketplaceService.listListings({
        keyword: keyword?.trim() || undefined,
        category: category?.trim() || undefined,
        duration,
        sortBy,
        page: page ?? CONTENT_MARKETPLACE_CATALOG_DEFAULTS.PAGE,
        perPage: perPage ?? CONTENT_MARKETPLACE_CATALOG_DEFAULTS.PER_PAGE,
      }),
    );
  }

  @Get("listings/:listingId")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "Get a content marketplace course",
    description:
      "Returns one published content marketplace listing, with the tenant's copy of it, if any.",
  })
  @Validate({
    request: [{ type: "param", name: "listingId", schema: UUIDSchema, required: true }],
    response: baseResponse(contentMarketplaceTenantListingSchema),
  })
  async getContentMarketplaceListing(@Param("listingId") listingId: UUIDType) {
    return new BaseResponse(await this.contentMarketplaceService.getListing(listingId));
  }

  @Get("listings/:listingId/thumbnail")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "Get a content marketplace course thumbnail",
    description: "Streams the listing's thumbnail image.",
  })
  @ApiProduces("image/*")
  @Validate({
    request: [{ type: "param", name: "listingId", schema: UUIDSchema, required: true }],
  })
  async streamContentMarketplaceThumbnail(
    @Param("listingId") listingId: UUIDType,
    @Res() response: Response,
  ) {
    const thumbnail = await this.contentMarketplaceService.openListingThumbnail(listingId);

    response.setHeader(
      "Content-Type",
      thumbnail.contentType ?? CONTENT_MARKETPLACE_THUMBNAIL_FALLBACK_CONTENT_TYPE,
    );
    response.setHeader("Cache-Control", "private, max-age=300");
    if (thumbnail.contentLength) response.setHeader("Content-Length", thumbnail.contentLength);

    Readable.fromWeb(thumbnail.body as NodeReadableStream<Uint8Array>).pipe(response);
  }

  @Post("listings/:listingId/copy")
  @RequirePermission(PERMISSIONS.CONTENT_MARKETPLACE_BROWSE)
  @ApiEndpointDocs({
    summary: "Copy a content marketplace course into the tenant",
    description:
      "Queues a native archive import that downloads the listing's current version into the current tenant, authored by the caller. Poll GET /native-archives/jobs/:jobId for the result. Copying the same listing again updates the existing copy. Also requires the course create permission.",
  })
  @Validate({
    request: [{ type: "param", name: "listingId", schema: UUIDSchema, required: true }],
    response: baseResponse(contentMarketplaceCopySchema),
  })
  async copyContentMarketplaceListing(
    @Param("listingId") listingId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return new BaseResponse(await this.contentMarketplaceService.copyListing(listingId, actor));
  }
}
