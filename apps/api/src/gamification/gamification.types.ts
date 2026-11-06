import type {
  AchievementIcon,
  AchievementRequirementType,
  AchievementVisibility,
  GamificationEventType,
  LocalizedText,
  SupportedLanguages,
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
  windowDays: number | null;
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
  icon: AchievementIcon;
  levels: { level: number; threshold: number; xpReward: number }[];
};

export type AchievementDefinitionInput = {
  title: LocalizedText;
  description: LocalizedText;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  eventType: GamificationEventType;
  requirementType: AchievementRequirementType;
  windowDays: number | null;
  filters: AchievementFilters;
  visibility: AchievementVisibility;
  isEnabled: boolean;
  icon: AchievementIcon;
  levels: { threshold: number; xpReward: number; badgeImageKey: string | null }[];
};
