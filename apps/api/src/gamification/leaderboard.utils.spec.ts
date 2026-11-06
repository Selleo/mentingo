import { BadRequestException } from "@nestjs/common";
import { LEADERBOARD_PERIODS } from "@repo/shared";

import { getLeaderboardRange } from "./leaderboard.utils";

const iso = (range: ReturnType<typeof getLeaderboardRange>) => ({
  startsAt: range.startsAt?.toISOString() ?? null,
  endsAt: range.endsAt?.toISOString() ?? null,
});

describe("getLeaderboardRange", () => {
  // Sunday late evening UTC: the ISO week still started on Monday the 2nd.
  const now = new Date("2026-11-08T23:30:00.000Z");

  it("starts the week on Monday in UTC", () => {
    expect(iso(getLeaderboardRange(LEADERBOARD_PERIODS.WEEK, now))).toEqual({
      startsAt: "2026-11-02T00:00:00.000Z",
      endsAt: null,
    });
  });

  it("starts the week today when today is Monday", () => {
    const monday = new Date("2026-11-02T08:00:00.000Z");

    expect(getLeaderboardRange(LEADERBOARD_PERIODS.WEEK, monday).startsAt?.toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
  });

  it("starts the month on its first day in UTC", () => {
    expect(iso(getLeaderboardRange(LEADERBOARD_PERIODS.MONTH, now))).toEqual({
      startsAt: "2026-11-01T00:00:00.000Z",
      endsAt: null,
    });
  });

  it("has no bounds for all time", () => {
    expect(iso(getLeaderboardRange(LEADERBOARD_PERIODS.ALL_TIME, now))).toEqual({
      startsAt: null,
      endsAt: null,
    });
  });

  it("includes both custom dates", () => {
    expect(
      iso(getLeaderboardRange(LEADERBOARD_PERIODS.CUSTOM, now, "2026-10-01", "2026-10-31")),
    ).toEqual({ startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" });
  });

  it.each([
    [undefined, "2026-10-31"],
    ["2026-10-01", undefined],
    ["2026-10-31", "2026-10-01"],
  ])("rejects an incomplete or reversed custom range (%s, %s)", (from, to) => {
    expect(() => getLeaderboardRange(LEADERBOARD_PERIODS.CUSTOM, now, from, to)).toThrow(
      BadRequestException,
    );
  });
});
