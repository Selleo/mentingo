import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const leaderboardScopeSchema = Type.Union([Type.Literal("all-time"), Type.Literal("month")]);

export const leaderboardRowSchema = Type.Object({
  userId: UUIDSchema,
  fullName: Type.String(),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  points: Type.Integer({ minimum: 0 }),
});

export const leaderboardSchema = Type.Object({
  top10: Type.Array(leaderboardRowSchema),
  ownRank: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  ownRow: Type.Union([leaderboardRowSchema, Type.Null()]),
});

export const leaderboardGroupSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
});

export type LeaderboardScope = Static<typeof leaderboardScopeSchema>;
export type LeaderboardRow = Static<typeof leaderboardRowSchema>;
export type LeaderboardResponse = Static<typeof leaderboardSchema>;
export type LeaderboardGroup = Static<typeof leaderboardGroupSchema>;
