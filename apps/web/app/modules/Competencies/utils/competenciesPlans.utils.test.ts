import { describe, expect, it } from "vitest";

import { getSubjectDocumentSteps } from "./competenciesPlans.utils";

import type { CompetencySubjectWorkspace } from "../competencies.types";

const asOf = "2026-01-01T00:00:00.000Z";

const buildWorkspace = (certificateUntil: string | null) =>
  ({
    asOf,
    warningDays: 30,
    assessment: null,
    evidence: [],
    competencies: [
      {
        id: "safety",
        archived: false,
        levels: [
          {
            id: "basic",
            conditions: [
              { id: "diploma", kind: "document" },
              { id: "certificate", kind: "document" },
            ],
          },
        ],
      },
    ],
    standings: [
      {
        competencyId: "safety",
        currentLevelId: "basic",
        expiring: certificateUntil !== null,
        levels: [
          {
            levelId: "basic",
            conditions: [
              { conditionId: "diploma", met: true, effectiveUntil: null },
              { conditionId: "certificate", met: true, effectiveUntil: certificateUntil },
            ],
          },
        ],
      },
    ],
  }) as unknown as CompetencySubjectWorkspace;

describe("getSubjectDocumentSteps", () => {
  it("asks to renew only the documents that are expiring", () => {
    const steps = getSubjectDocumentSteps(buildWorkspace("2026-01-10T00:00:00.000Z"));

    expect(steps.map((step) => step.condition.id)).toEqual(["certificate"]);
  });

  it("does not ask to renew documents outside the warning window", () => {
    const steps = getSubjectDocumentSteps(buildWorkspace("2026-06-01T00:00:00.000Z"));

    expect(steps).toEqual([]);
  });
});
