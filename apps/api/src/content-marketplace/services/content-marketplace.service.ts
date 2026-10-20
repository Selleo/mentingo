import { Readable } from "node:stream";

import { ContentMarketplaceApiError } from "@mentingo/content-marketplace-sdk";
import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match, P } from "ts-pattern";

import { hasPermission } from "src/common/permissions/permission.utils";
import { NATIVE_ARCHIVE_IMPORT_MODES } from "src/native-archive/native-archive.constants";
import { NativeArchiveJobService } from "src/native-archive/services/native-archive-job.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import {
  CONTENT_MARKETPLACE_COPY_STATUSES,
  CONTENT_MARKETPLACE_ERRORS,
  CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND,
} from "../content-marketplace.constants";
import { ContentMarketplaceCourseCopiedEvent } from "../events/content-marketplace-course-copied.event";
import { ContentMarketplaceLineageRepository } from "../repositories/content-marketplace-lineage.repository";
import { contentMarketplaceImportSourceSchema } from "../schemas/content-marketplace.schema";

import { ContentMarketplaceClientService } from "./content-marketplace-client.service";

import type { ContentMarketplaceConnection } from "../content-marketplace.types";
import type {
  ContentMarketplaceAvailability,
  ContentMarketplaceCatalogQuery,
  ContentMarketplaceCopy,
  ContentMarketplaceImportSource,
  ContentMarketplaceListing,
  ContentMarketplaceTenantListing,
} from "../schemas/content-marketplace.schema";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  NativeArchiveImportSource,
  NativeArchiveSourceDownload,
} from "src/native-archive/native-archive.types";

/**
 * The tenant side of the content marketplace: browsing listings and copying one into the tenant.
 * A copy queues a native-archive import that downloads the listing's archive when it runs and
 * imports it as a read-only shared course; copying the same listing again syncs that course in
 * place.
 */
@Injectable()
export class ContentMarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(ContentMarketplaceService.name);

  constructor(
    private readonly contentMarketplaceClientService: ContentMarketplaceClientService,
    private readonly nativeArchiveJobService: NativeArchiveJobService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly contentMarketplaceLineageRepository: ContentMarketplaceLineageRepository,
  ) {}

  onModuleInit(): void {
    this.nativeArchiveJobService.registerSourceArchiveDownloader(
      CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND,
      (importSource) => this.downloadAcquisitionArchive(importSource),
    );
  }

  /** Never throws: a tenant without a working connection simply has the marketplace off. */
  async getAvailability(): Promise<ContentMarketplaceAvailability> {
    const connection = await this.contentMarketplaceClientService.findTenantConnection();

    if (!connection) return { enabled: false };

    return { enabled: await this.isMarketplaceEnabled(connection) };
  }

  async listListings(query: ContentMarketplaceCatalogQuery) {
    const page = await this.callEnabledMarketplace((connection) =>
      this.contentMarketplaceClientService.listCatalogPage(connection, query),
    );

    return { ...page, data: await this.attachCopiedCourses(page.data) };
  }

  listCatalogFilters() {
    return this.callEnabledMarketplace((connection) =>
      this.contentMarketplaceClientService.listCatalogFilters(connection),
    );
  }

  async getListing(listingId: string) {
    const listing = await this.callEnabledMarketplace((connection) =>
      this.contentMarketplaceClientService.getListing(connection, listingId),
    );
    const [tenantListing] = await this.attachCopiedCourses([listing]);

    return tenantListing;
  }

  openListingThumbnail(listingId: string) {
    return this.callEnabledMarketplace(
      (connection) =>
        this.contentMarketplaceClientService.openListingThumbnail(connection, listingId),
      CONTENT_MARKETPLACE_ERRORS.THUMBNAIL_NOT_FOUND,
    );
  }

  /**
   * Copies a listing into the actor's tenant as a read-only shared course and returns the
   * native-archive import job to poll. Copying the same listing again syncs the existing copy to
   * the listing's current version, keeping its learners' progress.
   */
  async copyListing(listingId: string, actor: CurrentUserType): Promise<ContentMarketplaceCopy> {
    if (!hasPermission(actor.permissions, PERMISSIONS.COURSE_CREATE))
      throw new ForbiddenException("auth.error.missingPermission");

    const acquisition = await this.callEnabledMarketplace((connection) =>
      this.contentMarketplaceClientService.createAcquisition(connection, listingId),
    );
    const importSource: ContentMarketplaceImportSource = {
      kind: CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND,
      listingId,
      versionId: acquisition.versionId,
      acquisitionId: acquisition.acquisitionId,
    };

    try {
      const { jobId } = await this.nativeArchiveJobService.enqueueArchiveImportFromSource(
        importSource,
        actor,
        NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
      );

      return { jobId, acquisitionId: acquisition.acquisitionId };
    } catch (error) {
      await this.reportFailedCopy(actor, acquisition.acquisitionId);
      throw error;
    }
  }

  /** A copy is outdated once the listing publishes a version newer than the one it was copied from. */
  private async attachCopiedCourses(
    listings: ContentMarketplaceListing[],
  ): Promise<ContentMarketplaceTenantListing[]> {
    const importedCourses = await this.contentMarketplaceLineageRepository.findImportedCourses(
      listings.map((listing) => listing.id),
    );
    const importedCourseByListingId = new Map(
      importedCourses.map((importedCourse) => [importedCourse.listingId, importedCourse]),
    );

    return listings.map((listing) => {
      const importedCourse = importedCourseByListingId.get(listing.id);

      return {
        ...listing,
        copiedCourse: importedCourse
          ? {
              id: importedCourse.courseId,
              isOutdated: importedCourse.versionId !== listing.versionId,
            }
          : null,
      };
    });
  }

  /**
   * Supplies a copy's archive to its native-archive import job, which runs this in the copying
   * tenant's context. A failure fails the job, and the job's failed import reports the failed copy.
   */
  private async downloadAcquisitionArchive(
    importSource: NativeArchiveImportSource,
  ): Promise<NativeArchiveSourceDownload> {
    if (!Value.Check(contentMarketplaceImportSourceSchema, importSource))
      throw new Error("Invalid content marketplace import source");

    const archive = await this.callEnabledMarketplace((connection) =>
      this.contentMarketplaceClientService.openAcquisitionArchive(
        connection,
        importSource.acquisitionId,
      ),
    );

    return {
      stream: Readable.fromWeb(archive.body as NodeReadableStream<Uint8Array>),
      contentLength: archive.contentLength,
    };
  }

  /** Analytics never fail the user's copy: a report that cannot be queued is only logged. */
  private async reportFailedCopy(actor: CurrentUserType, acquisitionId: string) {
    try {
      await this.outboxPublisher.publish(
        new ContentMarketplaceCourseCopiedEvent(
          actor.tenantId,
          acquisitionId,
          CONTENT_MARKETPLACE_COPY_STATUSES.FAILED,
          null,
          new Date().toISOString(),
        ),
      );
    } catch {
      this.logger.warn(`Could not report the failed marketplace copy ${acquisitionId}`);
    }
  }

  /** Runs a plugin call for a tenant with the marketplace enabled, turning plugin errors into user-facing ones. */
  private async callEnabledMarketplace<T>(
    callMarketplace: (connection: ContentMarketplaceConnection) => Promise<T>,
    notFoundError: string = CONTENT_MARKETPLACE_ERRORS.LISTING_NOT_FOUND,
  ): Promise<T> {
    const connection = await this.contentMarketplaceClientService.findTenantConnection();

    if (!connection || !(await this.isMarketplaceEnabled(connection)))
      throw new ForbiddenException(CONTENT_MARKETPLACE_ERRORS.UNAVAILABLE);

    try {
      return await callMarketplace(connection);
    } catch (error) {
      if (!(error instanceof ContentMarketplaceApiError)) throw error;

      throw match(error.status)
        .with(404, () => new NotFoundException(notFoundError))
        .with(
          P.union(401, 403),
          () => new ForbiddenException(CONTENT_MARKETPLACE_ERRORS.UNAVAILABLE),
        )
        .otherwise(() => new BadGatewayException(CONTENT_MARKETPLACE_ERRORS.SERVICE_ERROR));
    }
  }

  private async isMarketplaceEnabled(connection: ContentMarketplaceConnection): Promise<boolean> {
    try {
      const configuration =
        await this.contentMarketplaceClientService.fetchConfiguration(connection);

      return configuration.capabilities.contentMarketplace.enabled;
    } catch {
      return false;
    }
  }
}
