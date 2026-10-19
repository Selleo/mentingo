import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import { CourseDuplicatedEvent } from "src/events";
import { NativeArchiveImportFinishedEvent } from "src/native-archive/events/native-archive-import-finished.event";
import { NATIVE_ARCHIVE_IMPORT_OUTCOMES } from "src/native-archive/native-archive.constants";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  CONTENT_MARKETPLACE_COPY_STATUSES,
  CONTENT_MARKETPLACE_EVENT_TYPES,
} from "../content-marketplace.constants";
import { ContentMarketplaceCourseCopiedEvent } from "../events/content-marketplace-course-copied.event";
import { ContentMarketplaceLineageRepository } from "../repositories/content-marketplace-lineage.repository";
import {
  contentMarketplaceCourseCopiedEventSchema,
  contentMarketplaceImportSourceSchema,
  courseDuplicatedEventSchema,
  nativeArchiveImportFinishedEventSchema,
} from "../schemas/content-marketplace.schema";
import { ContentMarketplaceEventDeliveryService } from "../services/content-marketplace-event-delivery.service";

/**
 * Reacts to committed outbox events: a finished marketplace import records the course's lineage,
 * a duplicate inherits its source course's lineage, and copies and duplications of marketplace
 * courses are queued for delivery to the plugin.
 * Each delivery reuses the outbox event ID, so a redelivered event is counted once.
 */
@Injectable()
export class ContentMarketplaceAnalyticsHandler implements OnModuleInit {
  constructor(
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly contentMarketplaceLineageRepository: ContentMarketplaceLineageRepository,
    private readonly contentMarketplaceEventDeliveryService: ContentMarketplaceEventDeliveryService,
  ) {}

  onModuleInit(): void {
    this.outboxDirectHandlerService.register(
      NativeArchiveImportFinishedEvent.name,
      (payload, eventId) => this.recordMarketplaceImport(payload, eventId),
    );
    this.outboxDirectHandlerService.register(
      ContentMarketplaceCourseCopiedEvent.name,
      (payload, eventId) => this.queueFailedCopyReport(payload, eventId),
    );
    this.outboxDirectHandlerService.register(CourseDuplicatedEvent.name, (payload, eventId) =>
      this.recordMarketplaceDuplication(payload, eventId),
    );
  }

  /** Imports queued by other features carry their own source and are left alone. */
  private async recordMarketplaceImport(payload: Record<string, unknown>, eventId: string) {
    if (!Value.Check(nativeArchiveImportFinishedEventSchema, payload))
      throw new Error("Invalid native archive import finished event");

    const { importSource } = payload;

    if (!Value.Check(contentMarketplaceImportSourceSchema, importSource)) return;

    const status = match(payload.outcome)
      .with(
        NATIVE_ARCHIVE_IMPORT_OUTCOMES.IMPORTED,
        () => CONTENT_MARKETPLACE_COPY_STATUSES.IMPORTED,
      )
      .with(NATIVE_ARCHIVE_IMPORT_OUTCOMES.FAILED, () => CONTENT_MARKETPLACE_COPY_STATUSES.FAILED)
      .exhaustive();
    const { courseId } = payload;

    if (courseId)
      await this.tenantDbRunnerService.runWithTenant(payload.tenantId, () =>
        this.contentMarketplaceLineageRepository.upsertCourseLineage(courseId, importSource),
      );

    await this.contentMarketplaceEventDeliveryService.enqueueEventDelivery({
      tenantId: payload.tenantId,
      event: {
        id: eventId,
        type: CONTENT_MARKETPLACE_EVENT_TYPES.COURSE_COPIED,
        occurredAt: payload.finishedAt,
        acquisitionId: importSource.acquisitionId,
        status,
        courseId,
      },
    });
  }

  private async queueFailedCopyReport(payload: Record<string, unknown>, eventId: string) {
    if (!Value.Check(contentMarketplaceCourseCopiedEventSchema, payload))
      throw new Error("Invalid content marketplace course copied event");

    await this.contentMarketplaceEventDeliveryService.enqueueEventDelivery({
      tenantId: payload.tenantId,
      event: {
        id: eventId,
        type: CONTENT_MARKETPLACE_EVENT_TYPES.COURSE_COPIED,
        occurredAt: payload.occurredAt,
        acquisitionId: payload.acquisitionId,
        status: payload.status,
        courseId: payload.courseId,
      },
    });
  }

  /** A duplicate keeps its source's lineage, so duplicates of duplicates are still counted. */
  private async recordMarketplaceDuplication(payload: Record<string, unknown>, eventId: string) {
    if (!Value.Check(courseDuplicatedEventSchema, payload))
      throw new Error("Invalid course duplicated event");

    const { tenantId, sourceCourseId, courseId } = payload;

    const lineage = await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const sourceLineage =
        await this.contentMarketplaceLineageRepository.findCourseLineage(sourceCourseId);

      if (sourceLineage)
        await this.contentMarketplaceLineageRepository.upsertCourseLineage(courseId, sourceLineage);

      return sourceLineage;
    });

    if (!lineage) return;

    await this.contentMarketplaceEventDeliveryService.enqueueEventDelivery({
      tenantId,
      event: {
        id: eventId,
        type: CONTENT_MARKETPLACE_EVENT_TYPES.COURSE_DUPLICATED,
        occurredAt: payload.duplicatedAt,
        listingId: lineage.listingId,
        acquisitionId: lineage.acquisitionId,
        courseId,
        parentCourseId: sourceCourseId,
      },
    });
  }
}
