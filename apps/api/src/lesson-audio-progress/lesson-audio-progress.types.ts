import type { UUIDType } from "src/common";
import type { ResourceMetadata } from "src/file/types/resource-metadata.type";
import type { VideoBucketRange } from "src/lesson-video-progress/utils/video-coverage-ranges";

export const LESSON_AUDIO_PROGRESS_ERROR_KEYS = {
  RESOURCE_NOT_FOUND: "studentLessonView.audioProgress.errors.resourceNotFound",
  UNSUPPORTED_LESSON_TYPE: "studentLessonView.audioProgress.errors.unsupportedLessonType",
  UNSUPPORTED_BUCKET_SIZE: "studentLessonView.audioProgress.errors.unsupportedBucketSize",
  INVALID_RESOURCE_TYPE: "studentLessonView.audioProgress.errors.invalidResourceType",
  ACCESS_DENIED: "studentLessonView.audioProgress.errors.accessDenied",
} as const;

export type AudioBucketRange = VideoBucketRange;

export type LessonAudioProgressRow = {
  lessonId: UUIDType;
  resourceEntityId: UUIDType;
  durationSeconds: number;
  bucketSizeSeconds: number;
  listenedRanges: AudioBucketRange[];
  coveredBucketCount: number;
  coveragePercent: number;
  isListened: boolean;
  listenedAt: string | null;
};

export type LessonAudioIdentity = {
  studentId: UUIDType;
  lessonId: UUIDType;
  resourceEntityId: UUIDType;
};

export type LessonAudioContext = {
  lessonId: UUIDType;
  lessonType: string;
  lessonCompleted: boolean;
  videoCompletionTrackingEnabled: boolean;
  audioCompletionTrackingEnabled: boolean;
  resourceEntityId: UUIDType;
  resourceContentType: string;
  resourceMetadata?: ResourceMetadata | null;
};

export type EnsureLessonAudioProgressRowParams = LessonAudioIdentity & {
  durationSeconds: number;
  bucketSizeSeconds: number;
};

export type NormalizeLessonAudioProgressRowParams = LessonAudioIdentity & {
  durationSeconds: number;
  maxBucketCount: number;
};

export type MergeLessonAudioListenedRangesParams = EnsureLessonAudioProgressRowParams & {
  ranges: AudioBucketRange[];
  activeListenSecondsDelta: number;
};

export type GetAudioProgressForResourceIdsParams = {
  lessonId: UUIDType;
  studentId: UUIDType;
  resourceEntityIds: UUIDType[];
};

export type GetAllowedNewListenedBucketCountParams = EnsureLessonAudioProgressRowParams & {
  activeListenSecondsDelta: number;
};

export type AddAcceptedListenSecondsParams = EnsureLessonAudioProgressRowParams & {
  acceptedBucketCount: number;
};

export type ListenSession = {
  lastFlushAt: number;
  acceptedListenSeconds: number;
  durationSeconds: number;
  bucketSizeSeconds: number;
};
