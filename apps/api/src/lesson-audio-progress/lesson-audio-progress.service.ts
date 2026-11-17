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
import {
  countBuckets,
  mergeBucketRanges,
  toBucketRanges,
} from "src/lesson-video-progress/utils/video-coverage-ranges";
import { getCanonicalVideoDurationSeconds } from "src/lesson-video-progress/utils/video-duration";
import { DB } from "src/storage/db/db.providers";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { LessonAudioListenSessionService } from "./lesson-audio-listen-session.service";
import {
  AUDIO_COMPLETION_COVERAGE_THRESHOLD,
  AUDIO_TRACKING_BUCKET_SIZE_SECONDS,
} from "./lesson-audio-progress.constants";
import { LESSON_AUDIO_PROGRESS_ERROR_KEYS } from "./lesson-audio-progress.types";
import { LessonAudioProgressRepository } from "./repositories/lesson-audio-progress.repository";

import type { GetAudioProgressForResourceIdsParams } from "./lesson-audio-progress.types";
import type { UpsertLessonAudioProgress } from "./schemas/lesson-audio-progress.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LessonAudioProgressService {
  constructor(
    private readonly lessonAudioProgressRepository: LessonAudioProgressRepository,
    private readonly listenSessionService: LessonAudioListenSessionService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly lessonMediaCompletionService: LessonMediaCompletionService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  async upsertProgress(body: UpsertLessonAudioProgress, currentUser: CurrentUserType) {
    const bucketSizeSeconds = body.bucketSize ?? AUDIO_TRACKING_BUCKET_SIZE_SECONDS;

    if (bucketSizeSeconds !== AUDIO_TRACKING_BUCKET_SIZE_SECONDS) {
      throw new BadRequestException(LESSON_AUDIO_PROGRESS_ERROR_KEYS.UNSUPPORTED_BUCKET_SIZE);
    }

    return this.db.transaction(async (trx) => {
      const audioIdentity = {
        studentId: currentUser.userId,
        lessonId: body.lessonId,
        resourceEntityId: body.resourceEntityId,
      };
      const context = await this.lessonAudioProgressRepository.getLessonAudioContext(
        audioIdentity,
        trx,
      );

      if (!context)
        throw new NotFoundException(LESSON_AUDIO_PROGRESS_ERROR_KEYS.RESOURCE_NOT_FOUND);
      if (context.lessonType !== LESSON_TYPES.CONTENT) {
        throw new BadRequestException(LESSON_AUDIO_PROGRESS_ERROR_KEYS.UNSUPPORTED_LESSON_TYPE);
      }
      if (!context.resourceContentType?.startsWith("audio/")) {
        throw new BadRequestException(LESSON_AUDIO_PROGRESS_ERROR_KEYS.INVALID_RESOURCE_TYPE);
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
        throw new ForbiddenException(LESSON_AUDIO_PROGRESS_ERROR_KEYS.ACCESS_DENIED);
      }

      const canonicalDurationSeconds = getCanonicalVideoDurationSeconds(context.resourceMetadata);
      const initialProgress = await this.lessonAudioProgressRepository.ensureProgressRow(
        {
          ...audioIdentity,
          durationSeconds: Math.ceil(body.durationSeconds),
          bucketSizeSeconds,
        },
        trx,
      );
      const currentProgress = canonicalDurationSeconds
        ? await this.lessonAudioProgressRepository.normalizeProgressRow(
            {
              ...audioIdentity,
              durationSeconds: canonicalDurationSeconds,
              maxBucketCount: Math.max(1, Math.ceil(canonicalDurationSeconds / bucketSizeSeconds)),
            },
            trx,
          )
        : initialProgress;
      const durationSeconds = canonicalDurationSeconds ?? currentProgress.durationSeconds;
      const bucketRanges = mergeBucketRanges(
        toBucketRanges({
          watchedRanges: body.listenedRanges,
          durationSeconds,
          bucketSizeSeconds,
        }),
      );

      const existingCoverage = mergeBucketRanges(currentProgress.listenedRanges);
      const mergedCoverage = mergeBucketRanges([...existingCoverage, ...bucketRanges]);
      const newUniqueBucketCount = countBuckets(mergedCoverage) - countBuckets(existingCoverage);
      const allowedNewBucketCount = await this.listenSessionService.getAllowedNewBucketCount({
        ...audioIdentity,
        durationSeconds,
        bucketSizeSeconds,
        activeListenSecondsDelta: body.activeListenSecondsDelta ?? 0,
      });

      const shouldAcceptRanges =
        bucketRanges.length > 0 &&
        newUniqueBucketCount > 0 &&
        newUniqueBucketCount <= allowedNewBucketCount;

      const progress = shouldAcceptRanges
        ? await this.lessonAudioProgressRepository.mergeListenedRanges(
            {
              ...audioIdentity,
              durationSeconds,
              bucketSizeSeconds,
              ranges: bucketRanges,
              activeListenSecondsDelta: Math.min(
                body.activeListenSecondsDelta ?? 0,
                newUniqueBucketCount * bucketSizeSeconds,
              ),
            },
            trx,
          )
        : currentProgress;

      if (shouldAcceptRanges) {
        await this.listenSessionService.addAcceptedListenSeconds({
          ...audioIdentity,
          durationSeconds,
          bucketSizeSeconds,
          acceptedBucketCount: newUniqueBucketCount,
        });
      }

      const listenedProgress =
        context.audioCompletionTrackingEnabled &&
        !progress.isListened &&
        progress.coveragePercent >= AUDIO_COMPLETION_COVERAGE_THRESHOLD
          ? await this.lessonAudioProgressRepository.markListened(audioIdentity, trx)
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
        ...listenedProgress,
        lessonCompleted,
      };
    });
  }

  async getProgressForResources(params: GetAudioProgressForResourceIdsParams) {
    return this.lessonAudioProgressRepository.getProgressForResourceIds(params);
  }
}
