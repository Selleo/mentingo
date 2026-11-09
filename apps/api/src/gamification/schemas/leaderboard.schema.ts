import { LEADERBOARD_METRICS, LEADERBOARD_PERIODS } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const leaderboardMetricSchema = Type.Enum(LEADERBOARD_METRICS);
export const leaderboardPeriodSchema = Type.Enum(LEADERBOARD_PERIODS);
export const leaderboardDateSchema = Type.Optional(Type.String({ format: "date" }));

export const leaderboardEntrySchema = Type.Object({
  userId: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  score: Type.Integer({ minimum: 0 }),
  rank: Type.Integer({ minimum: 1 }),
});

export const leaderboardSchema = Type.Object({
  metric: leaderboardMetricSchema,
  period: leaderboardPeriodSchema,
  groupId: Type.Union([UUIDSchema, Type.Null()]),
  startsAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  endsAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  entries: Type.Array(leaderboardEntrySchema),
  currentUser: Type.Union([leaderboardEntrySchema, Type.Null()]),
  nearby: Type.Array(leaderboardEntrySchema),
});

export const leaderboardScopesSchema = Type.Object({
  tenantWide: Type.Boolean(),
  groups: Type.Array(Type.Object({ id: UUIDSchema, name: Type.String() })),
});

export type LeaderboardEntry = Static<typeof leaderboardEntrySchema>;
export type LeaderboardResponse = Static<typeof leaderboardSchema>;
export type LeaderboardScopesResponse = Static<typeof leaderboardScopesSchema>;
