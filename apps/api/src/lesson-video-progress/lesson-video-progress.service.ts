import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import {
  VIDEO_COMPLETION_COVERAGE_THRESHOLD,
  VIDEO_TRACKING_BUCKET_SIZE_SECONDS,
} from "./lesson-video-progress.constants";
import { LESSON_VIDEO_PROGRESS_ERROR_KEYS } from "./lesson-video-progress.types";
import { LessonVideoWatchSessionService } from "./lesson-video-watch-session.service";
import { LessonVideoProgressRepository } from "./repositories/lesson-video-progress.repository";
import { countBuckets, mergeBucketRanges, toBucketRanges } from "./utils/video-coverage-ranges";

import type { GetProgressForResourceIdsParams } from "./lesson-video-progress.types";
import type { UpsertLessonVideoProgress } from "./schemas/lesson-video-progress.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LessonVideoProgressService {
  constructor(
    private readonly lessonVideoProgressRepository: LessonVideoProgressRepository,
    private readonly watchSessionService: LessonVideoWatchSessionService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async upsertProgress(body: UpsertLessonVideoProgress, currentUser: CurrentUserType) {
    const bucketSizeSeconds = body.bucketSize ?? VIDEO_TRACKING_BUCKET_SIZE_SECONDS;
    const durationSeconds = Math.ceil(body.durationSeconds);

    if (bucketSizeSeconds !== VIDEO_TRACKING_BUCKET_SIZE_SECONDS) {
      throw new BadRequestException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.UNSUPPORTED_BUCKET_SIZE);
    }

    const bucketRanges = mergeBucketRanges(
      toBucketRanges({
        watchedRanges: body.watchedRanges,
        durationSeconds,
        bucketSizeSeconds,
      }),
    );

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
      if (!context.videoCompletionTrackingEnabled) {
        throw new BadRequestException(LESSON_VIDEO_PROGRESS_ERROR_KEYS.TRACKING_DISABLED);
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

      const currentProgress = await this.lessonVideoProgressRepository.ensureProgressRow(
        {
          studentId: currentUser.userId,
          lessonId: body.lessonId,
          resourceEntityId: body.resourceEntityId,
          durationSeconds,
          bucketSizeSeconds,
        },
        trx,
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
        !progress.isWatched && progress.coveragePercent >= VIDEO_COMPLETION_COVERAGE_THRESHOLD
          ? await this.lessonVideoProgressRepository.markWatched(
              {
                studentId: currentUser.userId,
                lessonId: body.lessonId,
                resourceEntityId: body.resourceEntityId,
              },
              trx,
            )
          : progress;

      const requiredVideos =
        await this.lessonVideoProgressRepository.getRequiredVideoProgressForLesson(
          {
            lessonId: body.lessonId,
            studentId: currentUser.userId,
          },
          trx,
        );

      const lessonCompleted =
        requiredVideos.length > 0 && requiredVideos.every((video) => video.isWatched);

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
