import { describe, expect, it } from "vitest";

import { formatDuration, formatDurationToHalfHour } from "../formatDuration";

import type { TFunction } from "i18next";

const t = ((key: string, options?: { hours?: number; minutes?: number }) => {
  const hours = options?.hours ?? 0;
  const minutes = options?.minutes ?? 0;

  const translations: Record<string, string> = {
    "modernCourseView.stats.duration.minutes": `${minutes} min`,
    "modernCourseView.stats.duration.hours": `${hours} h`,
    "modernCourseView.stats.duration.hoursAndMinutes": `${hours} h ${minutes} min`,
  };

  return translations[key] ?? key;
}) as TFunction;

describe("formatDuration", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [59, "1 min"],
    [3600, "1 h"],
    [3660, "1 h 1 min"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds, t)).toBe(expected);
  });
});

describe("formatDurationToHalfHour", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [60, "30 min"],
    [1_800, "30 min"],
    [1_801, "1 h"],
    [3_600, "1 h"],
    [3_601, "1 h 30 min"],
    [5_400, "1 h 30 min"],
    [5_401, "2 h"],
  ])("rounds %s seconds up to the nearest half hour as %s", (seconds, expected) => {
    expect(formatDurationToHalfHour(seconds, t)).toBe(expected);
  });
});
