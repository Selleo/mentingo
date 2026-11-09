import { describe, expect, it } from "vitest";

import { minutesToTimeValue, timeValueToMinutes } from "./timeLimitTime";

describe("time limit time value", () => {
  it.each([
    [null, ""],
    [0, ""],
    [5, "00:05"],
    [90, "01:30"],
    [300, "05:00"],
  ])("formats %p minutes as %p", (minutes, expected) => {
    expect(minutesToTimeValue(minutes)).toBe(expected);
  });

  it.each([
    ["", null],
    ["00:00", null],
    ["00:05", 5],
    ["01:30", 90],
    ["06:40", 400],
  ])("parses %p as %p minutes", (value, expected) => {
    expect(timeValueToMinutes(value)).toBe(expected);
  });
});
