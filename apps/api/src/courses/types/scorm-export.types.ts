import type {
  ScormExportAssetReference,
  ScormExportCourseSnapshot,
  ScormExportPackageFile,
} from "@repo/scorm-export-generator";
import type { SupportedLanguages } from "@repo/shared";
import type { Readable } from "node:stream";
import type { UUIDType } from "src/common";
import type { scormScos } from "src/storage/schema";

export type CourseScormExportResult = {
  stream: Readable;
  filename: string;
  contentType: string;
};

export type CourseScormSnapshotResult = {
  snapshot: ScormExportCourseSnapshot;
  authorId: UUIDType;
};

export type CourseScormScoRow = typeof scormScos.$inferSelect & {
  packageLanguage: SupportedLanguages;
  extractedFilesReference: string;
};

export type CourseScormLessonRow = {
  id: UUIDType;
  chapterId: UUIDType;
  title: string;
  description: string | null;
  type: string;
  displayOrder: number | null;
  thresholdScore: number | null;
};

export type CourseScormLessonAssetRow = {
  lessonId: UUIDType;
  id: UUIDType;
  reference: string;
  contentType: string;
  metadata: unknown;
  title: string;
};

export type CourseScormResourceAssetRow = Omit<CourseScormLessonAssetRow, "lessonId">;

export type CourseScormQuizQuestionRow = {
  id: UUIDType;
  lessonId: UUIDType;
  type: string;
  title: string;
  description: string | null;
  solutionExplanation: string | null;
  displayOrder: number | null;
  photoS3Key: string | null;
};

export type CourseScormQuizOptionRow = {
  id: UUIDType;
  questionId: UUIDType;
  title: string;
  isCorrect: boolean;
  displayOrder: number | null;
  matchedWord: string | null;
};

export type CourseScormBuildLessonsByIdOptions = {
  lessonRows: CourseScormLessonRow[];
  lessonAssets: CourseScormLessonAssetRow[];
  quizQuestions: CourseScormQuizQuestionRow[];
  quizOptions: CourseScormQuizOptionRow[];
  scormScoRows: CourseScormScoRow[];
  language: SupportedLanguages;
};

export type CourseScormValidateRequiredAssetsOptions = {
  lessonRows: CourseScormLessonRow[];
  lessonAssets: CourseScormLessonAssetRow[];
  quizQuestions: CourseScormQuizQuestionRow[];
  scormScoRows: CourseScormScoRow[];
};

export type CourseScormAssetCollectionResult = {
  snapshot: ScormExportCourseSnapshot;
  files: ScormExportPackageFile[];
};

export type CourseScormAssetResolution = {
  asset: ScormExportAssetReference;
  packagePath: string;
  file?: ScormExportPackageFile;
};

export type CourseScormCollectAssetsOptions = {
  tenantOrigin?: string | null;
};
