import type {
  AchievementRequirementType,
  AchievementVisibility,
  GamificationEventType,
  LocalizedText,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { AchievementFilters } from "src/storage/schema";

export type GamificationEventSource = {
  outboxEventType: string;
  userIdPath: string[];
  supportModePath: string[];
  subjectPath: string[] | null;
  courseIdPath: string[] | null;
  scorePath: string[] | null;
};

export type EvaluateUserJobData = {
  tenantId: UUIDType;
  userId: UUIDType;
  sourceEventId: UUIDType | null;
};

export type RecalculateTenantJobData = {
  tenantId: UUIDType;
};

export type EvaluableAchievement = {
  id: UUIDType;
  eventType: GamificationEventType;
  requirementType: AchievementRequirementType;
  filters: AchievementFilters;
  levels: { id: UUIDType; level: number; threshold: number; xpReward: number }[];
};

export type PredefinedAchievement = {
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  eventType: GamificationEventType;
  requirementType: AchievementRequirementType;
  filters: AchievementFilters;
  visibility: AchievementVisibility;
  levels: { level: number; threshold: number; xpReward: number }[];
};
