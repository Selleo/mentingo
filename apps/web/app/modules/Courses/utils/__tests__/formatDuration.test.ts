import { describe, expect, it } from "vitest";

import { formatDuration, formatDurationToHalfHour } from "../formatDuration";

describe("formatDuration", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [59, "1 min"],
    [3600, "1 h"],
    [3660, "1 h 1 min"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("formatDurationToHalfHour", () => {
  it.each([
    [undefined, "0 min"],
    [0, "0 min"],
    [60, "30 min"],
    [1_800, "30 min"],
    [1_801, "1h"],
    [3_600, "1h"],
    [3_601, "1h 30min"],
    [5_400, "1h 30min"],
    [5_401, "2h"],
  ])("rounds %s seconds up to the nearest half hour as %s", (seconds, expected) => {
    expect(formatDurationToHalfHour(seconds)).toBe(expected);
  });
});
