import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ENTITY_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { createLessonResourceIdRegex } from "src/lesson/lesson-resource-references";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { DB } from "src/storage/db/db.providers";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import {
  VIDEO_COMPLETION_COVERAGE_THRESHOLD,
  VIDEO_TRACKING_BUCKET_SIZE_SECONDS,
} from "./lesson-video-progress.constants";
import { LESSON_VIDEO_PROGRESS_ERROR_KEYS } from "./lesson-video-progress.types";
import { LessonVideoWatchSessionService } from "./lesson-video-watch-session.service";
import { LessonVideoProgressRepository } from "./repositories/lesson-video-progress.repository";
import { countBuckets, mergeBucketRanges, toBucketRanges } from "./utils/video-coverage-ranges";
import { getCanonicalVideoDurationSeconds } from "./utils/video-duration";

import type { GetProgressForResourceIdsParams } from "./lesson-video-progress.types";
import type { UpsertLessonVideoProgress } from "./schemas/lesson-video-progress.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LessonVideoProgressService {
  constructor(
    private readonly lessonVideoProgressRepository: LessonVideoProgressRepository,
    private readonly watchSessionService: LessonVideoWatchSessionService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly fileService: FileService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  private async getInternalVideoResourceEntityIdsInContent(
    body: Pick<UpsertLessonVideoProgress, "lessonId" | "language">,
    dbInstance: DatabasePg,
  ) {
    const [lessonDescription, lessonResources] = await Promise.all([
      this.lessonVideoProgressRepository.getLocalizedLessonDescription(
        body.lessonId,
        body.language,
        dbInstance,
      ),
      this.fileService.getResourcesForEntity(
        body.lessonId,
        ENTITY_TYPES.LESSON,
        RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      ),
    ]);

    const { internalVideoResourceEntityIds } = injectResourcesIntoContent(
      lessonDescription,
      lessonResources.map((resource) => ({
        id: resource.id,
        resourceEntityId: resource.resourceEntityId,
        fileUrl: resource.fileUrl,
        fileUrlError: resource.fileUrlError,
        contentType: resource.contentType,
      })),
      {
        resourceIdRegex: createLessonResourceIdRegex(),
        trackNodeTypes: ["video"],
        convertImageAnchors: false,
      },
    );

    return internalVideoResourceEntityIds;
  }

  async upsertProgress(body: UpsertLessonVideoProgress, currentUser: CurrentUserType) {
    const bucketSizeSeconds = body.bucketSize ?? VIDEO_TRACKING_BUCKET_SIZE_SECONDS;

    if (bucketSizeSeconds !== VIDEO_TRACKING_BUCKET_SIZE_SECONDS) {
      throw new BadRequestException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.UNSUPPORTED_BUCKET_SIZE);
    }

    return this.db.transaction(async (trx) => {
      const context = await this.lessonVideoProgressRepository.getLessonVideoContext(
        {
          lessonId: body.lessonId,
          resourceEntityId: body.resourceEntityId,
          studentId: currentUser.userId,
        },
        trx,
      );

      if (!context)
        throw new NotFoundException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.RESOURCE_NOT_FOUND);
      if (context.lessonType !== LESSON_TYPES.CONTENT) {
        throw new BadRequestException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.UNSUPPORTED_LESSON_TYPE);
      }
      if (!context.resourceContentType?.startsWith("video/")) {
        throw new BadRequestException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.INVALID_RESOURCE_TYPE);
      }

      const lessonProgressAccess = await this.studentLessonProgressService.getLessonProgressAccess(
        body.lessonId,
        currentUser.userId,
        currentUser.permissions,
        trx,
      );

      if (!lessonProgressAccess?.canTrackProgress && !lessonProgressAccess?.isFreemium) {
        throw new ForbiddenException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.ACCESS_DENIED);
      }

      const canonicalDurationSeconds = getCanonicalVideoDurationSeconds(context.resourceMetadata);
      const requestedDurationSeconds = Math.ceil(body.durationSeconds);
      const initialProgress = await this.lessonVideoProgressRepository.ensureProgressRow(
        {
          studentId: currentUser.userId,
          lessonId: body.lessonId,
          resourceEntityId: body.resourceEntityId,
          durationSeconds: requestedDurationSeconds,
          bucketSizeSeconds,
        },
        trx,
      );
      const currentProgress = canonicalDurationSeconds
        ? await this.lessonVideoProgressRepository.normalizeProgressRow(
            {
              studentId: currentUser.userId,
              lessonId: body.lessonId,
              resourceEntityId: body.resourceEntityId,
              durationSeconds: canonicalDurationSeconds,
              maxBucketCount: Math.max(1, Math.ceil(canonicalDurationSeconds / bucketSizeSeconds)),
            },
            trx,
          )
        : initialProgress;
      const durationSeconds = canonicalDurationSeconds ?? currentProgress.durationSeconds;
      const bucketRanges = mergeBucketRanges(
        toBucketRanges({
          watchedRanges: body.watchedRanges,
          durationSeconds,
          bucketSizeSeconds,
        }),
      );

      const existingCoverage = mergeBucketRanges(currentProgress.watchedRanges);
      const mergedCoverage = mergeBucketRanges([...existingCoverage, ...bucketRanges]);
      const newUniqueBucketCount = countBuckets(mergedCoverage) - countBuckets(existingCoverage);
      const allowedNewBucketCount = await this.watchSessionService.getAllowedNewBucketCount({
        studentId: currentUser.userId,
        lessonId: body.lessonId,
        resourceEntityId: body.resourceEntityId,
        durationSeconds,
        bucketSizeSeconds,
        activeWatchSecondsDelta: body.activeWatchSecondsDelta ?? 0,
      });

      const shouldAcceptRanges =
        bucketRanges.length > 0 &&
        newUniqueBucketCount > 0 &&
        newUniqueBucketCount <= allowedNewBucketCount;

      const progress = shouldAcceptRanges
        ? await this.lessonVideoProgressRepository.mergeWatchedRanges(
            {
              studentId: currentUser.userId,
              lessonId: body.lessonId,
              resourceEntityId: body.resourceEntityId,
              durationSeconds,
              bucketSizeSeconds,
              ranges: bucketRanges,
              activeWatchSecondsDelta: Math.min(
                body.activeWatchSecondsDelta ?? 0,
                newUniqueBucketCount * bucketSizeSeconds,
              ),
            },
            trx,
          )
        : currentProgress;

      if (shouldAcceptRanges) {
        await this.watchSessionService.addAcceptedWatchSeconds({
          studentId: currentUser.userId,
          lessonId: body.lessonId,
          resourceEntityId: body.resourceEntityId,
          durationSeconds,
          bucketSizeSeconds,
          acceptedBucketCount: newUniqueBucketCount,
        });
      }

      const watchedProgress =
        context.videoCompletionTrackingEnabled &&
        !progress.isWatched &&
        progress.coveragePercent >= VIDEO_COMPLETION_COVERAGE_THRESHOLD
          ? await this.lessonVideoProgressRepository.markWatched(
              {
                studentId: currentUser.userId,
                lessonId: body.lessonId,
                resourceEntityId: body.resourceEntityId,
              },
              trx,
            )
          : progress;

      const requiredInternalVideoResourceEntityIds = context.videoCompletionTrackingEnabled
        ? await this.getInternalVideoResourceEntityIdsInContent(body, trx)
        : [];
      const requiredVideos =
        context.videoCompletionTrackingEnabled && requiredInternalVideoResourceEntityIds.length > 0
          ? await this.lessonVideoProgressRepository.getRequiredVideoProgressForLesson(
              {
                lessonId: body.lessonId,
                studentId: currentUser.userId,
                resourceEntityIds: requiredInternalVideoResourceEntityIds,
              },
              trx,
            )
          : [];

      const lessonCompleted =
        context.videoCompletionTrackingEnabled &&
        requiredVideos.length > 0 &&
        requiredVideos.every((video) => video.isWatched);

      if (lessonCompleted && !context.lessonCompleted) {
        await this.studentLessonProgressService.markLessonAsCompleted({
          id: body.lessonId,
          studentId: currentUser.userId,
          userPermissions: currentUser.permissions,
          actor: currentUser,
          dbInstance: trx,
          language: body.language ?? SUPPORTED_LANGUAGES.EN,
        });
      }

      return {
        ...watchedProgress,
        lessonCompleted: lessonCompleted || context.lessonCompleted,
      };
    });
  }

  async getProgressForResources(params: GetProgressForResourceIdsParams) {
    return this.lessonVideoProgressRepository.getProgressForResourceIds(params);
  }
}
