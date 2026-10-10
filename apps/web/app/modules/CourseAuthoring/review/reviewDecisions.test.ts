import { describe, expect, it } from "vitest";

import {
  acceptProposals,
  decisionSummary,
  initialDecisions,
  nodeDecision,
  rejectProposals,
} from "./reviewDecisions";

import type { ReviewProposal } from "./curriculumReview.types";

const proposal = (id: string, dependsOnProposalIds: string[] = []): ReviewProposal => ({
  id,
  summary: id,
  rationale: "",
  warnings: [],
  blockedQuality: false,
  decision: "pending",
  operationIds: [],
  dependsOnProposalIds,
  courseLevel: false,
});

// chapter <- lesson <- quiz: the lesson needs the new chapter, the quiz needs the lesson.
const proposals = [
  proposal("chapter"),
  proposal("lesson", ["chapter"]),
  proposal("quiz", ["lesson"]),
];

describe("review decisions", () => {
  it("includes pending changes in the initial review selection", () => {
    expect(initialDecisions(proposals)).toEqual({
      chapter: "accepted",
      lesson: "accepted",
      quiz: "accepted",
    });
  });
  it("accepting a change also accepts everything it needs", () => {
    expect(acceptProposals(["quiz"], {}, proposals)).toEqual({
      quiz: "accepted",
      lesson: "accepted",
      chapter: "accepted",
    });
  });

  it("rejecting a change also rejects everything that needs it", () => {
    expect(rejectProposals(["chapter"], {}, proposals)).toEqual({
      chapter: "rejected",
      lesson: "rejected",
      quiz: "rejected",
    });
  });

  it("never changes a proposal that is already applied", () => {
    const applied = [
      { ...proposal("chapter"), decision: "applied" as const },
      proposal("lesson", ["chapter"]),
    ];
    expect(rejectProposals(["chapter"], initialDecisions(applied), applied)).toEqual({
      chapter: "accepted",
      lesson: "rejected",
    });
  });

  it("reports a partial node when its proposals disagree", () => {
    expect(nodeDecision(["a", "b"], { a: "accepted" })).toBe("partial");
    expect(nodeDecision(["a", "b"], { a: "accepted", b: "accepted" })).toBe("accepted");
    expect(nodeDecision(["a"], {})).toBe("pending");
  });

  it("splits staged decisions for the apply step", () => {
    const summary = decisionSummary(proposals, { chapter: "accepted", quiz: "rejected" });
    expect(summary.accepted.map((item) => item.id)).toEqual(["chapter"]);
    expect(summary.rejected.map((item) => item.id)).toEqual(["quiz"]);
    expect(summary.pending.map((item) => item.id)).toEqual(["lesson"]);
  });
});
