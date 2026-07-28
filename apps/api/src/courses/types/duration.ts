import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CourseDurationHierarchy = {
  totalSeconds: number;
  byChapterId: Record<UUIDType, number>;
  byLessonId: Record<UUIDType, number>;
};

export type CourseDurationSummary = {
  totalMinutes: number;
  formatted: string;
};

export type CourseDurationMinutes = {
  totalMinutes: number;
};

export type CourseDurationEstimateCacheEntry = CourseDurationMinutes & {
  sourceSignature: string;
};

export type CourseDurationEstimatesByLanguage = Partial<
  Record<SupportedLanguages, CourseDurationEstimateCacheEntry>
>;

export type DurationEstimatesByCourse = Record<UUIDType, CourseDurationMinutes>;

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
