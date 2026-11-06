import { BadRequestException } from "@nestjs/common";
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from "@repo/shared";
import { match } from "ts-pattern";

import type { LeaderboardRange } from "./leaderboard.types";

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const parseUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

/**
 * Periods use UTC like login streaks: a week starts on Monday (ISO week), a month on its first day,
 * and neither has an end. A custom range includes both dates; `endsAt` is exclusive.
 */
export const getLeaderboardRange = (
  period: LeaderboardPeriod,
  now: Date,
  from?: string,
  to?: string,
): LeaderboardRange =>
  match(period)
    .with(LEADERBOARD_PERIODS.WEEK, () => {
      const today = startOfUtcDay(now);
      const daysSinceMonday = (today.getUTCDay() + 6) % 7;

      return { startsAt: new Date(today.getTime() - daysSinceMonday * DAY_MS), endsAt: null };
    })
    .with(LEADERBOARD_PERIODS.MONTH, () => ({
      startsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      endsAt: null,
    }))
    .with(LEADERBOARD_PERIODS.ALL_TIME, () => ({ startsAt: null, endsAt: null }))
    .with(LEADERBOARD_PERIODS.CUSTOM, () => {
      if (!from || !to || from > to) {
        throw new BadRequestException("gamification.leaderboard.invalidRange");
      }

      return {
        startsAt: parseUtcDate(from),
        endsAt: new Date(parseUtcDate(to).getTime() + DAY_MS),
      };
    })
    .exhaustive();
