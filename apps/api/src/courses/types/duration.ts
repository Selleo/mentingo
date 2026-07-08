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

export type DurationEstimatesByCourse = Record<UUIDType, CourseDurationSummary>;

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
