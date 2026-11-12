import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { match, P } from "ts-pattern";

import { CourseDuplicatedEvent } from "src/events";
import { NativeArchiveImportFinishedEvent } from "src/native-archive/events/native-archive-import-finished.event";
import { NATIVE_ARCHIVE_IMPORT_OUTCOMES } from "src/native-archive/native-archive.constants";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  CONTENT_MARKETPLACE_COPY_STATUSES,
  CONTENT_MARKETPLACE_EVENT_TYPES,
} from "../content-marketplace.constants";
import { ContentMarketplaceCourseCopiedEvent } from "../events/content-marketplace-course-copied.event";
import { ContentMarketplaceLineageRepository } from "../repositories/content-marketplace-lineage.repository";
import { contentMarketplaceImportSourceSchema } from "../schemas/content-marketplace.schema";
import { ContentMarketplaceEventDeliveryService } from "../services/content-marketplace-event-delivery.service";

import type { ContentMarketplaceCourseCopiedData } from "../events/content-marketplace-course-copied.event";
import type { CourseDuplicatedData } from "src/events";
import type { NativeArchiveImportFinishedData } from "src/native-archive/events/native-archive-import-finished.event";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type ContentMarketplaceOutboxEvent =
  | NativeArchiveImportFinishedEvent
  | ContentMarketplaceCourseCopiedEvent
  | CourseDuplicatedEvent;

/**
 * Reacts to committed outbox events: a finished marketplace import records the course's lineage,
 * a duplicate inherits its source course's lineage, and copies and duplications of marketplace
 * courses are queued for delivery to the plugin.
 * Each delivery reuses the outbox event ID, so a redelivered event is counted once.
 */
@Injectable()
@OutboxEventsHandler(
  NativeArchiveImportFinishedEvent,
  ContentMarketplaceCourseCopiedEvent,
  CourseDuplicatedEvent,
)
export class ContentMarketplaceAnalyticsHandler
  implements OutboxEventsHandlerOf<ContentMarketplaceOutboxEvent>
{
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly contentMarketplaceLineageRepository: ContentMarketplaceLineageRepository,
    private readonly contentMarketplaceEventDeliveryService: ContentMarketplaceEventDeliveryService,
  ) {}

  async handleOutboxEvent(
    event: ContentMarketplaceOutboxEvent,
    { eventId }: OutboxDeliveryContext,
  ) {
    await match(event)
      .with(P.instanceOf(NativeArchiveImportFinishedEvent), (importFinished) =>
        this.recordMarketplaceImport(importFinished.importFinishedData, eventId),
      )
      .with(P.instanceOf(ContentMarketplaceCourseCopiedEvent), (courseCopied) =>
        this.queueFailedCopyReport(courseCopied.courseCopiedData, eventId),
      )
      .with(P.instanceOf(CourseDuplicatedEvent), (courseDuplicated) =>
        this.recordMarketplaceDuplication(courseDuplicated.courseDuplicatedData, eventId),
      )
      .exhaustive();
  }

  /** Imports queued by other features carry their own source and are left alone. */
  private async recordMarketplaceImport(payload: NativeArchiveImportFinishedData, eventId: string) {
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

  private async queueFailedCopyReport(
    payload: ContentMarketplaceCourseCopiedData,
    eventId: string,
  ) {
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
  private async recordMarketplaceDuplication(payload: CourseDuplicatedData, eventId: string) {
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
