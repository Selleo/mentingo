import { describe, expect, it } from "vitest";

import { getExpiringConditions, isConditionExpiring } from "./competenciesExpiry.utils";

import type {
  Competency,
  CompetencyConditionAssessment,
  CompetencyStanding,
} from "./competencies.types";

const asOf = "2026-10-22T10:00:00Z";
const result = (conditionId: string, effectiveUntil: string | null) => ({
  conditionId,
  met: true,
  reason: null,
  evidenceIds: ["shared-proof"],
  effectiveFrom: "2026-10-01T10:00:00Z",
  effectiveUntil,
});

describe("condition expiry", () => {
  it("includes only current confirmations within the configured warning horizon", () => {
    const expires = result("condition", "2026-10-25T10:00:00Z");
    expect(isConditionExpiring(expires, asOf, 3)).toBe(true);
    expect(isConditionExpiring(expires, asOf, 2)).toBe(false);
    expect(isConditionExpiring(expires, asOf, null)).toBe(false);
    expect(isConditionExpiring({ ...expires, met: false }, asOf, 30)).toBe(false);
    expect(isConditionExpiring(result("condition", null), asOf, 30)).toBe(false);
    expect(isConditionExpiring(result("condition", asOf), asOf, 30)).toBe(false);
    expect(isConditionExpiring(undefined, asOf, 30)).toBe(false);
  });

  it("names cumulative supporting conditions once and excludes higher levels and lasting proof", () => {
    const definition = {
      levels: [
        { id: "first", conditions: [{ id: "observation" }, { id: "lasting" }] },
        { id: "second", conditions: [{ id: "document" }, { id: "later" }] },
        { id: "third", conditions: [{ id: "advanced" }] },
      ],
    } as Competency;
    const first: CompetencyConditionAssessment[] = [
      result("observation", "2026-10-25T10:00:00Z"),
      result("lasting", null),
    ];
    const second = [
      ...first,
      result("document", "2026-10-27T10:00:00Z"),
      result("later", "2026-12-01T10:00:00Z"),
    ];
    const standing = {
      currentLevelId: "second",
      levels: [
        { levelId: "first", met: true, conditions: first },
        { levelId: "second", met: true, conditions: second },
        {
          levelId: "third",
          met: false,
          conditions: [...second, result("advanced", "2026-10-23T10:00:00Z")],
        },
      ],
    } as CompetencyStanding;
    expect(
      getExpiringConditions(definition, standing, asOf, 7).map((item) => [
        item.condition.id,
        item.level,
        item.effectiveUntil,
      ]),
    ).toEqual([
      ["observation", 1, "2026-10-25T10:00:00Z"],
      ["document", 2, "2026-10-27T10:00:00Z"],
    ]);
    expect(
      getExpiringConditions(definition, { ...standing, currentLevelId: null }, asOf, 7),
    ).toEqual([]);
  });
});
