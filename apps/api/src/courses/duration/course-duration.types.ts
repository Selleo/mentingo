import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { ResourceMetadata } from "src/file/types/resource-metadata.type";

export type CourseDurationHierarchy = {
  totalSeconds: number;
  byChapterId: Record<UUIDType, number>;
  byLessonId: Record<UUIDType, number>;
};

export type DurationEstimate = {
  totalSeconds: number;
};

export type DurationEstimatesByLanguage = Partial<Record<SupportedLanguages, DurationEstimate>>;

export type CourseDurationSummary = {
  totalMinutes: number;
  formatted: string;
};

export type CourseDurationEstimatesByLanguage = DurationEstimatesByLanguage;

export type DurationEstimatesByCourse = Record<UUIDType, DurationEstimate>;

export type DurationResource = {
  id: UUIDType;
  resourceEntityId: UUIDType | null;
  contentType: string;
  metadata: ResourceMetadata | null;
};

export type LessonDurationCalculationParams = {
  descriptionHtml?: string | null;
  quizQuestionCount: number;
  lessonType: string;
  resourcesByReference?: Map<string, DurationResource>;
};

export type DurationCourseRow = {
  id: UUIDType;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type DurationLessonRow = {
  id: UUIDType;
  chapterId: UUIDType;
  type: string;
  description: LocalizedText | null;
  questionCount: number;
};

export type DurationProjection = {
  lessons: Map<UUIDType, DurationEstimatesByLanguage>;
  chapters: Map<UUIDType, DurationEstimatesByLanguage>;
  courses: Map<UUIDType, DurationEstimatesByLanguage>;
};

export type DurationProjectionUpdate = {
  id: UUIDType;
  durationEstimates: DurationEstimatesByLanguage;
};

export type DurationDb = DatabasePg;

export type DurationHeuristics = {
  wordsPerMinute: number;
  videoMinutes: number;
  imageSeconds: number;
  downloadSeconds: number;
  quizSeconds: number;
  aiMentorMinutes: number;
  embedMinutes: number;
  otherSeconds: number;
};

export type DurationResourceKind = "video" | "image" | "download" | "other";
