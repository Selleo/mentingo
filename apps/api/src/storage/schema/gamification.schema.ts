import {
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_TYPES,
  type AchievementRequirementType,
  type AchievementVisibility,
  type GamificationEventType,
  type LocalizedText,
  type XpTransactionType,
} from "@repo/shared";
import { sql } from "drizzle-orm";
import { boolean, check, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import {
  availableLocales,
  baseLanguage,
  id,
  tenantId,
  timestamps,
  withTenantIdIndex,
} from "./utils";

import { users } from ".";

// Values come from shared constants, never from user input.
const sqlValueList = (values: Record<string, string>) =>
  sql.raw(
    Object.values(values)
      .map((value) => `'${value}'`)
      .join(", "),
  );

export type AchievementFilters = {
  courseId?: string;
  minScore?: number;
};

export const achievements = pgTable(
  "achievements",
  {
    ...id,
    ...timestamps,
    tenantId,
    // Set for predefined achievements so seeding stays idempotent; null for custom ones.
    key: text("key"),
    title: jsonb("title").$type<LocalizedText>().notNull().default({}),
    description: jsonb("description").$type<LocalizedText>().notNull().default({}),
    eventType: text("event_type").$type<GamificationEventType>().notNull(),
    requirementType: text("requirement_type").$type<AchievementRequirementType>().notNull(),
    filters: jsonb("filters").$type<AchievementFilters>().notNull().default({}),
    visibility: text("visibility")
      .$type<AchievementVisibility>()
      .notNull()
      .default(ACHIEVEMENT_VISIBILITY.VISIBLE),
    isEnabled: boolean("is_enabled").notNull().default(true),
    baseLanguage,
    availableLocales,
  },
  withTenantIdIndex("achievements", (table) => ({
    tenantKeyUnique: unique("achievements_tenant_key_unique").on(table.tenantId, table.key),
    eventTypeCheck: check(
      "achievements_event_type_check",
      sql`${table.eventType} IN (${sqlValueList(GAMIFICATION_EVENT_TYPES)})`,
    ),
    requirementTypeCheck: check(
      "achievements_requirement_type_check",
      sql`${table.requirementType} IN (${sqlValueList(ACHIEVEMENT_REQUIREMENT_TYPES)})`,
    ),
    visibilityCheck: check(
      "achievements_visibility_check",
      sql`${table.visibility} IN (${sqlValueList(ACHIEVEMENT_VISIBILITY)})`,
    ),
  })),
);

export const achievementLevels = pgTable(
  "achievement_levels",
  {
    ...id,
    ...timestamps,
    tenantId,
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    threshold: integer("threshold").notNull(),
    xpReward: integer("xp_reward").notNull(),
  },
  withTenantIdIndex("achievement_levels", (table) => ({
    achievementLevelUnique: unique("achievement_levels_achievement_level_unique").on(
      table.achievementId,
      table.level,
    ),
    // A threshold below 1 would grant the level to every user on the next evaluation.
    levelCheck: check("achievement_levels_level_check", sql`${table.level} >= 1`),
    thresholdCheck: check("achievement_levels_threshold_check", sql`${table.threshold} >= 1`),
    xpRewardCheck: check("achievement_levels_xp_reward_check", sql`${table.xpReward} >= 0`),
  })),
);

export const userAchievementProgress = pgTable(
  "user_achievement_progress",
  {
    ...id,
    ...timestamps,
    tenantId,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    value: integer("value").notNull().default(0),
  },
  withTenantIdIndex("user_achievement_progress", (table) => ({
    userAchievementUnique: unique("user_achievement_progress_user_achievement_unique").on(
      table.userId,
      table.achievementId,
    ),
    valueCheck: check("user_achievement_progress_value_check", sql`${table.value} >= 0`),
  })),
);

export const userAchievementLevels = pgTable(
  "user_achievement_levels",
  {
    ...id,
    ...timestamps,
    tenantId,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementLevelId: uuid("achievement_level_id")
      .notNull()
      .references(() => achievementLevels.id, { onDelete: "cascade" }),
    // Outbox event whose evaluation granted the level; null when granted by tenant recalculation.
    sourceEventId: uuid("source_event_id"),
  },
  withTenantIdIndex("user_achievement_levels", (table) => ({
    userLevelUnique: unique("user_achievement_levels_user_level_unique").on(
      table.userId,
      table.achievementLevelId,
    ),
  })),
);

export const xpTransactions = pgTable(
  "xp_transactions",
  {
    ...id,
    ...timestamps,
    tenantId,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<XpTransactionType>().notNull(),
    sourceId: uuid("source_id").notNull(),
    lifetimeDelta: integer("lifetime_delta").notNull(),
    spendableDelta: integer("spendable_delta").notNull(),
  },
  withTenantIdIndex("xp_transactions", (table) => ({
    typeSourceUnique: unique("xp_transactions_type_source_unique").on(table.type, table.sourceId),
    // Lifetime XP never decreases; spendable deltas may go negative once XP can be spent.
    lifetimeDeltaCheck: check(
      "xp_transactions_lifetime_delta_check",
      sql`${table.lifetimeDelta} >= 0`,
    ),
  })),
);

export const userGamificationProfiles = pgTable(
  "user_gamification_profiles",
  {
    ...id,
    ...timestamps,
    tenantId,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lifetimeXp: integer("lifetime_xp").notNull().default(0),
    spendableXp: integer("spendable_xp").notNull().default(0),
    level: integer("level").notNull().default(1),
  },
  withTenantIdIndex("user_gamification_profiles", (table) => ({
    userUnique: unique("user_gamification_profiles_user_unique").on(table.userId),
    xpCheck: check(
      "user_gamification_profiles_xp_check",
      sql`${table.spendableXp} >= 0 AND ${table.spendableXp} <= ${table.lifetimeXp}`,
    ),
    levelCheck: check("user_gamification_profiles_level_check", sql`${table.level} >= 1`),
  })),
);
