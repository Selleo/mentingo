import { Inject, Injectable, Logger } from "@nestjs/common";
import { COURSE_GENERATION_SYNC_SOCKET_EVENT, COURSE_GENERATION_SYNC_STATUS } from "@repo/shared";

import { getUserRoomKey } from "src/file/utils/userRoom";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { LumaCourseGenerationSyncQueueService } from "src/luma/luma-course-generation-sync-queue.service";
import { LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS } from "src/luma/luma-course-generation-sync.constants";
import { LumaCourseGenerationSyncRepository } from "src/luma/luma-course-generation-sync.repository";
import { LumaGeneratedCourseImportService } from "src/luma/luma-generated-course-import.service";
import { LumaService } from "src/luma/luma.service";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LumaCourseGenerationSyncRecord } from "src/luma/luma-course-generation-sync.repository";
import type { SerializedLumaCourseGenerationSyncStatus } from "src/luma/luma.types";
import type { LumaCourseGenerationSyncJobData } from "src/queue";

@Injectable()
export class LumaCourseGenerationSyncService {
  private readonly logger = new Logger(LumaCourseGenerationSyncService.name);

  constructor(
    private readonly adminLessonService: AdminLessonService,
    private readonly lumaService: LumaService,
    private readonly lumaGeneratedCourseImportService: LumaGeneratedCourseImportService,
    private readonly lumaCourseGenerationSyncQueueService: LumaCourseGenerationSyncQueueService,
    private readonly lumaCourseGenerationSyncRepository: LumaCourseGenerationSyncRepository,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async enqueueGeneratedCourseBundleSync(courseId: UUIDType, currentUser: CurrentUserType) {
    await this.validateCourseAccess(courseId, currentUser);

    const claimed = await this.lumaCourseGenerationSyncRepository.tryMarkProcessing(courseId);
    if (!claimed) {
      return this.serialize(
        await this.lumaCourseGenerationSyncRepository.ensureNotStarted(courseId, null),
      );
    }

    try {
      await this.lumaCourseGenerationSyncQueueService.enqueueSyncJob({ courseId, currentUser });
    } catch (error) {
      const lastError = this.sanitizeError(error);
      const failed = await this.lumaCourseGenerationSyncRepository.markFailed(courseId, lastError);
      const serialized = this.serialize(failed);
      this.publishStatusChanged(courseId, serialized, currentUser.userId, {
        messageKey: LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.FAILED,
        error: lastError,
      });

      return serialized;
    }

    return this.serialize(claimed);
  }

  async processGeneratedCourseBundleSync(data: LumaCourseGenerationSyncJobData) {
    try {
      const luma = await this.lumaService.getLumaClient();
      this.logger.log(`Fetching Luma generated course bundle: courseId=${data.courseId}`);
      const bundle = await luma.getGeneratedCourseBundle({ integrationId: data.courseId });
      this.logger.log(
        `Fetched Luma generated course bundle: courseId=${data.courseId}, chapters=${bundle.course.chapters.length}, assets=${bundle.assets.length}`,
      );

      const result = await this.lumaGeneratedCourseImportService.importBundle(
        data.courseId,
        bundle,
        data.currentUser,
      );

      const serialized = this.serialize(result.sync);
      this.publishStatusChanged(data.courseId, serialized, data.currentUser.userId, {
        messageKey:
          result.stats.skippedAssetCount > 0
            ? LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.PROCESSED_WITH_ASSET_WARNINGS
            : LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.PROCESSED,
      });

      return serialized;
    } catch (error) {
      const lastError = this.sanitizeError(error);
      this.logger.error(
        `Luma course generation sync failed for course ${data.courseId}: ${lastError}`,
        error instanceof Error ? error.stack : undefined,
      );

      const failed = await this.lumaCourseGenerationSyncRepository.markFailed(
        data.courseId,
        lastError,
      );
      const serialized = this.serialize(failed);
      this.publishStatusChanged(data.courseId, serialized, data.currentUser.userId, {
        messageKey: LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.FAILED,
        error: lastError,
      });

      return serialized;
    }
  }

  async dismissSync(courseId: UUIDType, currentUser: CurrentUserType) {
    await this.validateCourseAccess(courseId, currentUser);

    await this.lumaCourseGenerationSyncRepository.ensureNotStarted(courseId, null);
    const dismissed = await this.lumaCourseGenerationSyncRepository.markDismissed(courseId);
    const serialized = this.serialize(dismissed);
    this.publishStatusChanged(courseId, serialized, currentUser.userId, {
      messageKey: LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.DISMISSED,
    });

    return serialized;
  }

  serialize(
    sync: LumaCourseGenerationSyncRecord | null,
    fallbackDraftId: UUIDType | null = null,
  ): SerializedLumaCourseGenerationSyncStatus {
    return {
      status: sync?.status ?? COURSE_GENERATION_SYNC_STATUS.NOT_STARTED,
      draftId: sync?.draftId ?? fallbackDraftId,
      attemptCount: sync?.attemptCount ?? 0,
      startedAt: sync?.startedAt ?? null,
      processedAt: sync?.processedAt ?? null,
      failedAt: sync?.failedAt ?? null,
      dismissedAt: sync?.dismissedAt ?? null,
      lastError: sync?.lastError ?? null,
    };
  }

  private async validateCourseAccess(courseId: UUIDType, currentUser: CurrentUserType) {
    await this.adminLessonService.validateAccess(ENTITY_TYPE.COURSE, currentUser, courseId);
  }

  private publishStatusChanged(
    courseId: UUIDType,
    status: SerializedLumaCourseGenerationSyncStatus,
    userId: UUIDType,
    options: { messageKey?: string; error?: string },
  ) {
    this.realtimePublisher.emitToRoom(COURSE_GENERATION_SYNC_SOCKET_EVENT, getUserRoomKey(userId), {
      courseId,
      ...status,
      messageKey: options.messageKey,
      error: options.error,
      userId,
    });
  }

  private sanitizeError(_error: unknown) {
    return LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.FAILED;
  }
}
