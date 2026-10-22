import { describe, expect, it } from "vitest";

import { canVerifyConditions } from "./competenciesVerifiers.utils";

import type { CompetenciesWorkspace } from "./competencies.types";

describe("condition verifier scope", () => {
  const workspace = {
    catalog: [
      {
        id: "competency",
        levels: [
          {
            conditions: [
              { id: "first", kind: "observation", verifierIds: ["first-verifier"] },
              { id: "second", kind: "document", verifierIds: ["second-verifier"] },
              { id: "unassigned", kind: "observation", verifierIds: [] },
              { id: "legacy", kind: "document" },
              ...["course", "quiz", "ai-mentor"].map((kind) => ({
                id: kind,
                kind,
                verifierIds: ["first-verifier"],
              })),
            ],
          },
        ],
      },
    ],
  } as unknown as CompetenciesWorkspace;

  it("requires designation for every covered condition, including mixed evidence", () => {
    expect(canVerifyConditions(workspace, "competency", ["first"], "first-verifier")).toBe(true);
    for (const ids of [["second"], ["first", "second"], ["unassigned"], ["missing"], []])
      expect(canVerifyConditions(workspace, "competency", ids, "first-verifier")).toBe(false);
  });

  it("requires an explicit verifier on every manual condition", () => {
    expect(canVerifyConditions(workspace, "competency", ["legacy"], "legacy-verifier")).toBe(false);
    expect(canVerifyConditions(workspace, "competency", ["unassigned"], "legacy-verifier")).toBe(
      false,
    );
  });
  it.each(["course", "quiz", "ai-mentor"])("does not allow manual verification of %s", (id) => {
    expect(canVerifyConditions(workspace, "competency", [id], "first-verifier")).toBe(false);
  });
});
