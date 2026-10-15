import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { REVIEW_CHANGE_KIND, REVIEW_NODE_TYPE } from "./curriculumReview.constants";
import { ReviewChangeDetail } from "./ReviewChangeDetail";

import type {
  CurriculumReviewModel,
  ReviewLessonNode,
  ReviewProposal,
} from "./curriculumReview.types";

const pendingProposal = (id: string, decision: ReviewProposal["decision"]): ReviewProposal => ({
  id,
  summary: id,
  rationale: "",
  warnings: [],
  blockedQuality: false,
  decision,
  operationIds: [],
  dependsOnProposalIds: [],
  courseLevel: false,
});

describe("ReviewChangeDetail", () => {
  it("keeps the detail focused on the proposed content", () => {
    const node: ReviewLessonNode = {
      nodeType: REVIEW_NODE_TYPE.LESSON,
      id: "lesson-1",
      chapterId: "chapter-1",
      title: "Lesson",
      previousTitle: null,
      lessonType: "content",
      kind: REVIEW_CHANGE_KIND.EDITED,
      movedFrom: null,
      current: null,
      operations: [],
      proposalIds: ["proposal-accepted", "proposal-pending"],
    };
    const model: CurriculumReviewModel = {
      course: null,
      chapters: [],
      changes: [{ key: "lesson:lesson-1", node }],
      counts: { added: 0, edited: 1, removed: 0, moved: 0 },
    };
    renderWith().render(
      <ReviewChangeDetail
        node={node}
        model={model}
        proposals={[
          pendingProposal("proposal-accepted", "accepted"),
          pendingProposal("proposal-pending", "pending"),
        ]}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Opis zmian" })).not.toBeInTheDocument();
  });
});
