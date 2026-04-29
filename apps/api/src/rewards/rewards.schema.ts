import { REWARD_ACTION_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const localizedTextSchema = Type.Partial(
  Type.Record(Type.Enum(SUPPORTED_LANGUAGES), Type.String()),
);

export const rewardActionTypeSchema = Type.Enum(REWARD_ACTION_TYPES);

export const rewardRuleSchema = Type.Object({
  id: UUIDSchema,
  actionType: rewardActionTypeSchema,
  points: Type.Number({ minimum: 0 }),
  enabled: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const updateRewardRuleSchema = Type.Object({
  points: Type.Number({ minimum: 0 }),
  enabled: Type.Boolean(),
});

export const rewardAchievementSchema = Type.Object({
  id: UUIDSchema,
  title: localizedTextSchema,
  description: localizedTextSchema,
  pointThreshold: Type.Number({ minimum: 0 }),
  sortOrder: Type.Number(),
  archived: Type.Boolean(),
  iconResourceId: Type.Union([UUIDSchema, Type.Null()]),
  iconUrl: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const upsertRewardAchievementSchema = Type.Object({
  title: localizedTextSchema,
  description: localizedTextSchema,
  pointThreshold: Type.Number({ minimum: 0 }),
  sortOrder: Type.Optional(Type.Number()),
  iconResourceId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
});

export const profileRewardAchievementSchema = Type.Object({
  id: UUIDSchema,
  title: localizedTextSchema,
  description: localizedTextSchema,
  pointThreshold: Type.Number(),
  pointsRequired: Type.Number(),
  earnedAt: Type.Union([Type.String(), Type.Null()]),
  iconResourceId: Type.Union([UUIDSchema, Type.Null()]),
  iconUrl: Type.Union([Type.String(), Type.Null()]),
});

export const rewardsProfileSchema = Type.Object({
  userId: UUIDSchema,
  totalPoints: Type.Number(),
  achievements: Type.Array(profileRewardAchievementSchema),
});

export const leaderboardEntrySchema = Type.Object({
  userId: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  totalPoints: Type.Number(),
  rank: Type.Number(),
});

export const leaderboardSchema = Type.Object({
  groupId: Type.Union([UUIDSchema, Type.Null()]),
  entries: Type.Array(leaderboardEntrySchema),
  currentUserRank: Type.Union([leaderboardEntrySchema, Type.Null()]),
});

export const rewardGroupSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
});

export const rewardPointsByDaySchema = Type.Object({
  date: Type.String(),
  points: Type.Number(),
});

export const rewardsBackfillSchema = Type.Object({
  chapterGrants: Type.Number(),
  aiConversationGrants: Type.Number(),
  courseGrants: Type.Number(),
});

export type UpdateRewardRuleBody = Static<typeof updateRewardRuleSchema>;
export type UpsertRewardAchievementBody = Static<typeof upsertRewardAchievementSchema>;
