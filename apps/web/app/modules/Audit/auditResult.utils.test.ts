import { describe, expect, it } from "vitest";

import { getAuditLevelKey, getRoadmapPhasePeriods } from "./auditResult.utils";

describe("audit result utilities", () => {
  it.each([
    [0, "level1"],
    [59, "level1"],
    [60, "level2"],
    [74, "level2"],
    [75, "level3"],
    [89, "level3"],
    [90, "level4"],
    [100, "level4"],
  ] as const)("maps score %i to %s", (score, level) => {
    expect(getAuditLevelKey(score)).toBe(level);
  });

  it("distributes roadmap phases across each supported pace", () => {
    expect(getRoadmapPhasePeriods("3")).toEqual(["1", "2", "3"]);
    expect(getRoadmapPhasePeriods("6")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(getRoadmapPhasePeriods("12")).toEqual(["q1", "q2", "q3", "q4"]);
  });
});
