import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AUTHORING_OPERATION_TYPE, PROPOSAL_DECISION } from "../review/curriculumReview.constants";

import { CourseCreationProposal } from "./CourseCreationProposal";

import type { AuthoringOperation, ProposalView } from "../courseAuthoring.types";

const operation: AuthoringOperation = {
  operationId: "operation",
  targetId: "draft",
  type: AUTHORING_OPERATION_TYPE.COURSE_CREATE,
  dependencies: [],
  payload: {
    title: "Working safely",
    description: "Practice inspecting equipment.",
    language: "pl",
    categoryTitle: "Safety",
    learningOutcomes: ["Inspect protective gear"],
    thumbnailAssetId: "cover",
  },
};

const proposal: ProposalView = {
  id: "proposal",
  revision: 1,
  taskId: null,
  summary: "New course",
  rationale: "",
  warnings: [],
  blockedQuality: false,
  qualityConcernsAccepted: false,
  evidenceCount: 0,
  operations: [operation],
  outline: null,
  decision: PROPOSAL_DECISION.PENDING,
  parentProposalId: null,
  manual: false,
  protectedEdits: [],
};

vi.mock("~/api/queries/useAuthoringAssetPreviewUrls", () => ({
  useAuthoringAssetPreviewUrls: () => ({
    urls: { cover: "blob:cover-preview" },
    loadingAssetIds: [],
    failedAssetIds: [],
  }),
}));

describe("course creation proposal", () => {
  it("previews the selected metadata and cover before recording a decision", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => {});
    const onDiscard = vi.fn(async () => {});
    renderWith({ withQuery: true }).render(
      <CourseCreationProposal
        courseId="draft"
        sessionId="session"
        operation={operation}
        proposal={proposal}
        readyAssetIds={["cover"]}
        waiting={false}
        busy={false}
        onCreate={onCreate}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByRole("heading", { name: "Working safely" })).toBeInTheDocument();
    expect(screen.getByText("Practice inspecting equipment.")).toBeInTheDocument();
    expect(screen.getByText("Polish")).toBeInTheDocument();
    expect(screen.getByText("Safety")).toBeInTheDocument();
    expect(screen.getByText("Inspect protective gear")).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "blob:cover-preview");
    expect(onCreate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create course" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
