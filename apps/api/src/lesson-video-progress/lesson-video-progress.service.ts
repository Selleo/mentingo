import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabasePg } from "src/common";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonMediaCompletionService } from "src/lesson-media-completion/lesson-media-completion.service";
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
    private readonly lessonMediaCompletionService: LessonMediaCompletionService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

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

      if (
        lessonProgressAccess?.isPublicCoursePreview ||
        (!lessonProgressAccess?.canTrackProgress && !lessonProgressAccess?.isFreemium)
      ) {
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

      const lessonCompleted =
        await this.lessonMediaCompletionService.completeLessonWhenRequiredMediaConsumed(
          {
            lessonId: body.lessonId,
            language: body.language,
            currentUser,
            lessonCompleted: context.lessonCompleted,
            videoCompletionTrackingEnabled: context.videoCompletionTrackingEnabled,
            audioCompletionTrackingEnabled: context.audioCompletionTrackingEnabled,
          },
          trx,
        );

      return {
        ...watchedProgress,
        lessonCompleted,
      };
    });
  }

  async getProgressForResources(params: GetProgressForResourceIdsParams) {
    return this.lessonVideoProgressRepository.getProgressForResourceIds(params);
  }
}
