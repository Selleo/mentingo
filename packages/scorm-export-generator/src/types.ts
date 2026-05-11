import type { Readable } from "node:stream";

export const SCORM_EXPORT_LESSON_TYPES = ["content", "quiz", "embed", "scorm"] as const;

export const SCORM_EXPORT_ASSET_TYPES = [
  "thumbnail",
  "logo",
  "contentResource",
  "quizResource",
  "video",
] as const;

export const SCORM_EXPORT_VALIDATION_ERROR_CODES = [
  "courseNotFound",
  "accessDenied",
  "noExportableLessons",
  "unsupportedLessonType",
  "missingAsset",
  "invalidSnapshot",
] as const;

export type ScormExportLessonType = (typeof SCORM_EXPORT_LESSON_TYPES)[number];
export type ScormExportAssetType = (typeof SCORM_EXPORT_ASSET_TYPES)[number];
export type ScormExportValidationErrorCode = (typeof SCORM_EXPORT_VALIDATION_ERROR_CODES)[number];

export type ScormExportAssetReference = {
  id: string;
  type: ScormExportAssetType;
  sourceReference: string;
  packagePath: string;
  contentType?: string;
};

export type ScormExportCourseSnapshot = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language: string;
  theme: ScormExportTheme;
  thumbnail?: ScormExportAssetReference | null;
  logo?: ScormExportAssetReference | null;
  settings: ScormExportFrozenSettings;
  chapters: ScormExportChapterSnapshot[];
  lessons: Record<string, ScormExportLessonSnapshot>;
};

export type ScormExportFrozenSettings = {
  quizFeedbackEnabled: boolean;
};

export type ScormExportTheme = {
  primaryColor: string | null;
  contrastColor: string | null;
};

export type ScormExportChapterSnapshot = {
  id: string;
  title: string;
  displayOrder?: number | null;
  lessonIds: string[];
};

export type ScormExportLessonSnapshot =
  | ScormExportContentLessonSnapshot
  | ScormExportQuizLessonSnapshot
  | ScormExportEmbedLessonSnapshot
  | ScormExportImportedScormLessonSnapshot;

export type ScormExportBaseLessonSnapshot = {
  id: string;
  title: string;
  type: ScormExportLessonType;
  displayOrder?: number | null;
};

export type ScormExportContentLessonSnapshot = ScormExportBaseLessonSnapshot & {
  type: "content";
  html: string;
  assets: ScormExportAssetReference[];
};

export type ScormExportQuizLessonSnapshot = ScormExportBaseLessonSnapshot & {
  type: "quiz";
  passingScorePercent?: number | null;
  questions: ScormExportQuizQuestion[];
};

export type ScormExportQuizQuestion = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  solutionExplanation?: string | null;
  displayOrder?: number | null;
  options: ScormExportQuizOption[];
  correctOptionIds: string[];
  assets: ScormExportAssetReference[];
};

export type ScormExportQuizOption = {
  id: string;
  title: string;
  displayOrder?: number | null;
  isCorrect: boolean;
  matchedWord?: string | null;
};

export type ScormExportEmbedLessonSnapshot = ScormExportBaseLessonSnapshot & {
  type: "embed";
  url: string;
  allowFullscreen: boolean;
};

export type ScormExportImportedScormLessonSnapshot = ScormExportBaseLessonSnapshot & {
  type: "scorm";
  packageId: string;
  extractedFilesReference: string;
  scos: ScormExportImportedScoSnapshot[];
};

export type ScormExportImportedScoSnapshot = {
  id: string;
  title: string;
  identifier: string;
  identifierRef?: string | null;
  resourceIdentifier?: string | null;
  href?: string | null;
  launchPath: string;
  files: string[];
  displayOrder: number;
  isVisible: boolean;
};

export type ScormExportCourseJson = {
  schemaVersion: 1;
  course: {
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    language: string;
    thumbnailPath?: string | null;
    logoPath: string;
  };
  theme: ScormExportTheme;
  settings: ScormExportFrozenSettings;
  chapters: ScormExportChapterSnapshot[];
  lessons: Record<string, ScormExportLessonSnapshot>;
};

export type ScormExportManifestResource = {
  identifier: string;
  href: string;
  files: string[];
};

export type ScormExportSuspendData = {
  introSeen?: boolean;
  lessons?: Record<string, ScormExportLessonSuspendData>;
};

export type ScormExportLessonSuspendData = {
  completed?: boolean;
  answers?: Record<string, string | string[]>;
};

export type ScormExportValidationError = {
  code: ScormExportValidationErrorCode;
  translationKey: string;
  details?: Record<string, unknown>;
};

export type ScormExportPackageFile = {
  path: string;
} & ({ buffer: Buffer } | { stream: Readable } | { streamFactory: () => Promise<Readable> });
