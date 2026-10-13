import { describe, expect, it } from "vitest";

import { toReviewProposals } from "./reviewProposals";

import type { ProposalView } from "../courseAuthoring.types";

const proposal = (id: string, includesChapter = true): ProposalView => ({
  id,
  revision: 1,
  taskId: `task-${id}`,
  summary: "Add lesson",
  rationale: "",
  warnings: [],
  blockedQuality: false,
  qualityConcernsAccepted: false,
  evidenceCount: 0,
  outline: null,
  decision: "pending",
  parentProposalId: null,
  manual: false,
  protectedEdits: [],
  operations: [
    ...(includesChapter
      ? [
          {
            operationId: "chapter-create",
            targetId: "chapter",
            type: "chapter.create",
            dependencies: [],
            payload: { title: "Chapter" },
          },
        ]
      : []),
    {
      operationId: `lesson-${id}`,
      targetId: id,
      type: "lesson.create",
      chapterId: "chapter",
      dependencies: ["chapter-create"],
      payload: { title: id, lessonType: "content" },
    },
  ],
});

describe("review proposal dependencies", () => {
  it("keeps each lesson independent when its shared chapter prerequisite is included locally", () => {
    const review = toReviewProposals([proposal("first"), proposal("second")]);
    expect(review.map((item) => item.dependsOnProposalIds)).toEqual([[], []]);
  });

  it("retains a dependency on another proposal when the prerequisite is not included locally", () => {
    const review = toReviewProposals([proposal("first"), proposal("second", false)]);
    expect(review[1].dependsOnProposalIds).toEqual(["first"]);
  });
});
