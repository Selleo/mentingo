import type { VideoBucketRange } from "./utils/video-coverage-ranges";
import type { UUIDType } from "src/common";

export const LESSON_VIDEO_PROGRESS_ERROR_KEYS = {
  RESOURCE_NOT_FOUND: "studentLessonView.videoProgress.errors.resourceNotFound",
  UNSUPPORTED_LESSON_TYPE: "studentLessonView.videoProgress.errors.unsupportedLessonType",
  UNSUPPORTED_BUCKET_SIZE: "studentLessonView.videoProgress.errors.unsupportedBucketSize",
  INVALID_RESOURCE_TYPE: "studentLessonView.videoProgress.errors.invalidResourceType",
  TRACKING_DISABLED: "studentLessonView.videoProgress.errors.trackingDisabled",
  ACCESS_DENIED: "studentLessonView.videoProgress.errors.accessDenied",
} as const;

export type LessonVideoProgressErrorKey =
  (typeof LESSON_VIDEO_PROGRESS_ERROR_KEYS)[keyof typeof LESSON_VIDEO_PROGRESS_ERROR_KEYS];

export type LessonVideoProgressRow = {
  lessonId: UUIDType;
  resourceEntityId: UUIDType;
  durationSeconds: number;
  bucketSizeSeconds: number;
  watchedRanges: VideoBucketRange[];
  coveredBucketCount: number;
  coveragePercent: number;
  isWatched: boolean;
  watchedAt: string | null;
};

export type LessonVideoIdentity = {
  studentId: UUIDType;
  lessonId: UUIDType;
  resourceEntityId: UUIDType;
};

export type LessonVideoContext = {
  lessonId: UUIDType;
  lessonType: string;
  chapterId: UUIDType;
  courseId: UUIDType;
  lessonCompleted: boolean;
  videoCompletionTrackingEnabled: boolean;
  resourceEntityId: UUIDType;
  resourceContentType: string;
};

export type EnsureLessonVideoProgressRowParams = LessonVideoIdentity & {
  durationSeconds: number;
  bucketSizeSeconds: number;
};

export type MergeLessonVideoProgressRangesParams = EnsureLessonVideoProgressRowParams & {
  ranges: VideoBucketRange[];
  activeWatchSecondsDelta: number;
};

export type GetRequiredVideoProgressForLessonParams = {
  lessonId: UUIDType;
  studentId: UUIDType;
};

export type GetProgressForResourceIdsParams = GetRequiredVideoProgressForLessonParams & {
  resourceEntityIds: UUIDType[];
};

export type GetAllowedNewBucketCountParams = EnsureLessonVideoProgressRowParams & {
  activeWatchSecondsDelta: number;
};

export type AddAcceptedWatchSecondsParams = EnsureLessonVideoProgressRowParams & {
  acceptedBucketCount: number;
};

export type WatchSession = {
  lastFlushAt: number;
  acceptedWatchSeconds: number;
  durationSeconds: number;
  bucketSizeSeconds: number;
};
