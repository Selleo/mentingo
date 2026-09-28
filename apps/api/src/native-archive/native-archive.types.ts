import type { NativeArchiveLearningPathImportSnapshot } from "./native-archive-learning-path.types";
import type {
  NATIVE_ARCHIVE_FORMAT,
  NATIVE_ARCHIVE_VERSION,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_JOB_ACTION,
} from "./native-archive.constants";
import type { NativeArchiveLiveTrainingLesson } from "./schemas/native-archive-live-training.schema";
import type { PERMISSIONS } from "@repo/shared";
import type { Readable } from "node:stream";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";
import type {
  calendarEvents,
  liveLessons,
  liveTrainings,
  resourceEntity,
  resources,
} from "src/storage/schema";

export type NativeArchiveKind = (typeof NATIVE_ARCHIVE_KIND)[keyof typeof NATIVE_ARCHIVE_KIND];

export type NativeArchiveImportResult = {
  kind: NativeArchiveKind;
  rootId: UUIDType;
  alreadyExists: boolean;
  createdCourseIds: UUIDType[];
  reusedCourseIds: UUIDType[];
};

export type NativeArchiveSnapshotResult = {
  courses: Record<string, Record<string, unknown>>;
  learningPath?: Record<string, unknown>;
  files: NativeArchiveFile[];
};

export type NativeArchiveValidatedCourseSnapshot = SourceSnapshot & {
  liveTrainingLessons?: NativeArchiveLiveTrainingLesson[];
};

export type NativeArchiveImportPlan = {
  missing: NativeArchiveValidatedCourseSnapshot[];
  reusedCourseIds: UUIDType[];
  learningPath?: NativeArchiveLearningPathImportSnapshot;
};

export type NativeArchiveLiveLesson = typeof liveLessons.$inferSelect;

export type NativeArchiveLiveTrainingExportRows = {
  liveLessons: NativeArchiveLiveLesson[];
  trainings: (typeof liveTrainings.$inferSelect)[];
  events: (typeof calendarEvents.$inferSelect)[];
  materials: {
    trainingId: typeof resourceEntity.$inferSelect.entityId;
    relationshipType: typeof resourceEntity.$inferSelect.relationshipType;
    resource: typeof resources.$inferSelect;
  }[];
};

export type NativeArchiveTrainingMaterialSnapshot = {
  relationshipType: typeof resourceEntity.$inferSelect.relationshipType;
  resource: NativeArchiveRecord;
};

export type NativeArchiveLiveTrainingLessonSnapshot = {
  lessonId: UUIDType;
  language: NativeArchiveLiveLesson["language"];
  training: NativeArchiveRecord;
  event: NativeArchiveRecord;
  materials: NativeArchiveTrainingMaterialSnapshot[];
};

export type NativeArchivePreparedAsset = NativeArchiveAsset & { stagedFilePath: string };

export type NativeArchiveScormAssetDirectory = {
  sourceReference: string;
  sourcePath: string;
  targetReference: string;
};

export type NativeArchiveStagedAssets = {
  snapshots: NativeArchiveValidatedCourseSnapshot[];
  rewriteReference: (reference: string | null) => string | null;
  rewriteValue: <T>(value: T) => T;
  deleteStaged: () => Promise<void>;
};

export type NativeArchiveJob = {
  action: (typeof NATIVE_ARCHIVE_JOB_ACTION)[keyof typeof NATIVE_ARCHIVE_JOB_ACTION];
  rootId?: UUIDType;
  key?: string;
  actor: CurrentUserType;
};

export type NativeArchiveUploadState = {
  id: string;
  key: string;
  multipartId: string;
  tenantId: string;
  userId: string;
  length: number;
  offset: number;
  completed: boolean;
  parts: { ETag: string; PartNumber: number }[];
};

export type NativeArchiveAsset = {
  path: string;
  sha256: string;
  byteLength: number;
  contentType: string;
  sourceReference: string;
};

export type NativeArchiveManifest = {
  format: typeof NATIVE_ARCHIVE_FORMAT;
  version: typeof NATIVE_ARCHIVE_VERSION;
  kind: NativeArchiveKind;
  rootId: UUIDType;
  courseIds: UUIDType[];
  exportedAt: string;
  applicationVersion: string;
  assets: NativeArchiveAsset[];
};

export type NativeArchiveDocument = {
  manifest: NativeArchiveManifest;
  courses: Record<string, Record<string, unknown>>;
  learningPath?: Record<string, unknown>;
};

export type NativeArchiveFile = {
  path: string;
  contentType: string;
  sourceReference: string;
  open: () => Promise<NodeJS.ReadableStream>;
};

export type ParsedNativeArchive = NativeArchiveDocument & {
  assetFiles: Map<string, string>;
  cleanup: () => Promise<void>;
};

export type NativeArchivePermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type NativeArchiveJobReceipt = { jobId: string };
export type NativeArchiveJobStatus = {
  jobId: string;
  state: string;
  result: Record<string, unknown> | null;
  failedReason: string | null;
};
export type NativeArchiveTusSession = {
  uploadId: string;
  tusEndpoint: string;
  tusHeaders: Record<string, string>;
  expiresAt: string;
  partSize: number;
};
export type NativeArchiveTusPatchResult = { offset: number; conflict: boolean };
export type NativeArchiveRestoredTraining = { trainingId: UUIDType; linkId: UUIDType };
export type NativeArchiveLiveTrainingRestoreItem = {
  record: NativeArchiveLiveTrainingLesson;
  sourceLesson: SourceSnapshot["lessons"][number];
  mappedChapterId: UUIDType;
};
export type NativeArchiveLiveTrainingRestoreState = {
  trainings: Map<string, NativeArchiveRestoredTraining>;
  lessons: Map<UUIDType, UUIDType>;
};

export type NativeArchiveBuildInput = {
  kind: NativeArchiveKind;
  rootId: UUIDType;
  courses: Record<string, Record<string, unknown>>;
  learningPath?: Record<string, unknown>;
  files: NativeArchiveFile[];
};
export type NativeArchiveBuiltZip = { stream: Readable; cleanup: () => Promise<void> };
export type NativeArchiveFileHash = { sha256: string; byteLength: number };
export type NativeArchiveRecord = Record<string, unknown>;

export type NativeArchiveExportResult = { key: string; kind: NativeArchiveKind; rootId: UUIDType };
export type NativeArchiveJobResult = NativeArchiveImportResult | NativeArchiveExportResult;
