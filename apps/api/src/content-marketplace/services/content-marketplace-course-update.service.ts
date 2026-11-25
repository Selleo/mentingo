import { ContentMarketplaceApiError } from "@mentingo/content-marketplace-sdk";
import { HttpStatus, Injectable } from "@nestjs/common";
import { compact } from "lodash";

import { processInBatches } from "src/common/utils/processInBatches";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CONTENT_MARKETPLACE_UPDATE_CHECK } from "../content-marketplace.constants";
import { ContentMarketplaceCourseUpdatesAvailableEvent } from "../events/content-marketplace-course-updates-available.event";
import { ContentMarketplaceLineageRepository } from "../repositories/content-marketplace-lineage.repository";

import { ContentMarketplaceClientService } from "./content-marketplace-client.service";
import { ContentMarketplaceService } from "./content-marketplace.service";

import type {
  ContentMarketplaceConnection,
  ContentMarketplaceTrackedCourse,
} from "../content-marketplace.types";
import type { ContentMarketplaceCourseUpdate } from "../schemas/content-marketplace.schema";
import type { UUIDType } from "src/common";

/**
 * Compares the current tenant's marketplace courses with their listings and announces all newly
 * published versions together, each version only once, so admins get one notice per check.
 */
@Injectable()
export class ContentMarketplaceCourseUpdateService {
  constructor(
    private readonly contentMarketplaceService: ContentMarketplaceService,
    private readonly contentMarketplaceClientService: ContentMarketplaceClientService,
    private readonly contentMarketplaceLineageRepository: ContentMarketplaceLineageRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async announceAvailableCourseUpdates(tenantId: UUIDType): Promise<void> {
    const connection = await this.contentMarketplaceClientService.findTenantConnection();
    if (!connection) return;

    const { enabled } = await this.contentMarketplaceService.getAvailability();
    if (!enabled) return;

    const trackedCourses = await this.contentMarketplaceLineageRepository.findTrackedCourses();
    const unannouncedUpdates = await this.findUnannouncedCourseUpdates(connection, trackedCourses);

    if (unannouncedUpdates.length) await this.announceCourseUpdates(tenantId, unannouncedUpdates);
  }

  private async findUnannouncedCourseUpdates(
    connection: ContentMarketplaceConnection,
    trackedCourses: ContentMarketplaceTrackedCourse[],
  ): Promise<ContentMarketplaceCourseUpdate[]> {
    const courseUpdates = await processInBatches(
      trackedCourses,
      async (trackedCourse) => {
        const listing = await this.findCurrentListing(connection, trackedCourse.listingId);
        if (!listing || !this.isUnannouncedUpdate(trackedCourse, listing.versionId)) return null;

        const { courseId, listingId } = trackedCourse;

        return { courseId, listingId, versionId: listing.versionId };
      },
      { batchSize: CONTENT_MARKETPLACE_UPDATE_CHECK.LISTING_BATCH_SIZE },
    );

    return compact(courseUpdates);
  }

  /** Claims every update in one transaction with its event, so a failed publish announces none of them. */
  private async announceCourseUpdates(
    tenantId: UUIDType,
    unannouncedUpdates: ContentMarketplaceCourseUpdate[],
  ) {
    await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      const claimedUpdates: ContentMarketplaceCourseUpdate[] = [];

      for (const courseUpdate of unannouncedUpdates) {
        const [claimedCourse] =
          await this.contentMarketplaceLineageRepository.claimCourseUpdateNotification(
            courseUpdate.courseId,
            courseUpdate.versionId,
            transaction,
          );

        if (claimedCourse) claimedUpdates.push(courseUpdate);
      }

      if (!claimedUpdates.length) return;

      await this.outboxPublisher.publish(
        new ContentMarketplaceCourseUpdatesAvailableEvent({
          tenantId,
          courseUpdates: claimedUpdates,
        }),
        transaction,
      );
    });
  }

  private isUnannouncedUpdate(
    { versionId, notifiedUpdateVersionId }: ContentMarketplaceTrackedCourse,
    currentVersionId: string,
  ) {
    return currentVersionId !== versionId && currentVersionId !== notifiedUpdateVersionId;
  }

  /** A listing the marketplace removed has no update to announce. */
  private async findCurrentListing(connection: ContentMarketplaceConnection, listingId: string) {
    try {
      return await this.contentMarketplaceClientService.getListing(connection, listingId);
    } catch (error) {
      if (error instanceof ContentMarketplaceApiError && error.status === HttpStatus.NOT_FOUND)
        return undefined;

      throw error;
    }
  }
}
