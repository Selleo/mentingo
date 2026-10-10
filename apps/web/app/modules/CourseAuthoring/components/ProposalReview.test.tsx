import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { ProposalGroup } from "./ProposalGroupCard";
import { ProposalReview } from "./ProposalReview";

import type { ProposalView } from "../courseAuthoring.types";

const attemptedQuizProposal: ProposalView = {
  id: "proposal-1",
  revision: 2,
  taskId: "task-1",
  summary: "Remove the old assessment",
  rationale: "The new outline replaces this quiz.",
  warnings: [],
  blockedQuality: false,
  qualityConcernsAccepted: false,
  evidenceCount: 1,
  outline: null,
  decision: "accepted",
  parentProposalId: null,
  manual: false,
  protectedEdits: [],
  operations: [
    {
      operationId: "operation-1",
      targetId: "quiz-lesson-1",
      type: "lesson.delete",
      dependencies: [],
      payload: {},
    },
  ],
};

describe("ProposalReview", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => document.body,
    });
    window.scrollBy = vi.fn();
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [new DOMRect(0, 0, 1, 16)],
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 1, 16),
    });
  });

  it("confirms impact before applying a change to an attempted quiz", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        attemptedTargetIds={["quiz-lesson-1"]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByLabelText("Select Remove the old assessment"));

    const applyButton = screen.getByRole("button", { name: "Apply selected" });
    expect(applyButton).toBeEnabled();
    await user.click(applyButton);

    const dialog = screen.getByRole("dialog", {
      name: "Existing quiz attempts and scores are affected",
    });
    expect(dialog).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "Acknowledge impact on existing quiz attempts" }),
    ).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    await user.click(applyButton);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Apply selected" }),
    );

    expect(onApply).toHaveBeenCalledWith(["proposal-1"], true, []);
  });

  it("keeps impact confirmation available when applying fails", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockRejectedValue(new Error("Apply failed"));

    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        attemptedTargetIds={["quiz-lesson-1"]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByLabelText("Select Remove the old assessment"));
    await user.click(screen.getByRole("button", { name: "Apply selected" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Apply selected" }),
    );

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply).toHaveBeenCalledWith(["proposal-1"], true, []);
    expect(
      screen.getByRole("dialog", { name: "Existing quiz attempts and scores are affected" }),
    ).toBeVisible();
  });

  it("does not show an empty apply toolbar before a proposal is selected", () => {
    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Apply selected" })).not.toBeInTheDocument();
  });

  it("does not render a second apply toolbar when proposal cards are hidden", () => {
    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        renderCards={false}
        selectedProposalIds={["proposal-1"]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Apply selected" })).not.toBeInTheDocument();
  });

  it("excludes durably applied proposals from the selected apply set", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const secondProposal = { ...attemptedQuizProposal, id: "proposal-2", summary: "Add example" };

    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal, secondProposal]}
        selectedProposalIds={["proposal-1", "proposal-2"]}
        applicationStatusByProposalId={{ "proposal-1": "applied" }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByText("1 accepted drafts selected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Apply selected" }));
    expect(onApply).toHaveBeenCalledWith(["proposal-2"], false, []);
  });

  it("keeps a final decision concise and hides decision actions", () => {
    renderWith().render(
      <ProposalReview
        compact
        proposals={[{ ...attemptedQuizProposal, decision: "rejected" }]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides selection and the staged apply toolbar for direct content apply", () => {
    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        autoApplyReadyContent
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Select Remove the old assessment")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply selected" })).toBeNull();
  });

  it("keeps automatic-apply retry compact and beside the synchronizing proposal", async () => {
    const user = userEvent.setup();
    const onRetryApply = vi.fn();

    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        applyState="synchronizing"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
        onRetryApply={onRetryApply}
        autoApplyReadyContent
        applicationStatusByProposalId={{ "proposal-1": "synchronizing" }}
      />,
    );

    expect(screen.getByText("Saving previous changes")).toBeVisible();
    expect(
      screen.queryByText(
        "The course update is already safe. Wait a moment, then retry this same apply request.",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry apply" }));

    expect(onRetryApply).toHaveBeenCalledOnce();
  });

  it("keeps conflicts contextual instead of offering an apply retry", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();

    renderWith().render(
      <ProposalReview
        compact
        proposals={[attemptedQuizProposal]}
        applyState="conflict"
        applicationStatusByProposalId={{ "proposal-1": "conflict" }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={onRegenerate}
        onApply={vi.fn()}
        onRetryApply={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry apply" })).not.toBeInTheDocument();
    expect(screen.getByText("Needs update")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Update proposal" }));

    expect(onRegenerate).toHaveBeenCalledWith(attemptedQuizProposal);
  });

  it("submits nonblank proposal feedback with the scoped proposal", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    const proposal = { ...attemptedQuizProposal, decision: "pending" as const };

    renderWith().render(
      <ProposalReview
        compact
        proposals={[proposal]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={onRegenerate}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.getByRole("dialog", { name: "Ask for changes" })).toBeVisible();
    const feedback = screen.getByRole("textbox", { name: "Change request" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(feedback, "Keep the quiz");
    await user.keyboard("{Enter}");
    await user.type(feedback, "Add a practical example");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onRegenerate).toHaveBeenCalledWith(proposal, "Keep the quiz\n\nAdd a practical example");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.getByText("0/2000")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Change request" })).toHaveTextContent(/^$/);
  });

  it("rejects empty and overlong rich-text proposal feedback", async () => {
    const user = userEvent.setup();
    const proposal = { ...attemptedQuizProposal, decision: "pending" as const };

    renderWith().render(
      <ProposalReview
        compact
        proposals={[proposal]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    const feedback = screen.getByRole("textbox", { name: "Change request" });
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    await user.type(feedback, "   ");
    expect(send).toBeDisabled();
    await user.clear(feedback);
    await user.paste("x".repeat(2001));

    expect(screen.getByText("2001/2000")).toBeVisible();
    expect(send).toBeDisabled();
  });

  it("keeps feedback in the open dialog when regeneration fails and clears it on cancel", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn().mockRejectedValue(new Error("Command failed"));
    const proposal = { ...attemptedQuizProposal, decision: "pending" as const };

    renderWith().render(
      <ProposalReview
        compact
        proposals={[proposal]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={onRegenerate}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    const feedback = screen.getByRole("textbox", { name: "Change request" });
    await user.type(feedback, "Keep the quiz");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledOnce());

    expect(screen.getByRole("dialog", { name: "Ask for changes" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Change request" })).toHaveTextContent(
      "Keep the quiz",
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    expect(screen.getByRole("textbox", { name: "Change request" })).toHaveTextContent(/^$/);
  });

  it("prevents duplicate sends and dismissal while regeneration is pending", async () => {
    const user = userEvent.setup();
    let resolveRegeneration!: () => void;
    const onRegenerate = vi.fn(
      (_proposal: ProposalView, _feedback?: string) =>
        new Promise<void>((resolve) => {
          resolveRegeneration = resolve;
        }),
    );
    const proposal = { ...attemptedQuizProposal, decision: "pending" as const };

    renderWith().render(
      <ProposalReview
        compact
        proposals={[proposal]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={onRegenerate}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    await user.type(screen.getByRole("textbox", { name: "Change request" }), "Keep the quiz");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledOnce());

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Ask for changes" })).toBeVisible();
    expect(onRegenerate).toHaveBeenCalledOnce();

    resolveRegeneration();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  const groupProposals = [
    {
      ...attemptedQuizProposal,
      id: "proposal-a",
      summary: "Create lesson one",
      decision: "pending" as const,
    },
    {
      ...attemptedQuizProposal,
      id: "proposal-b",
      summary: "Create lesson two",
      decision: "pending" as const,
    },
  ];

  it("summarizes a request's changes and opens curriculum review from one action", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const onDiscard = vi.fn();

    renderWith().render(
      <ProposalGroup
        requestId="request-1"
        proposals={groupProposals}
        onReview={onReview}
        onDiscard={onDiscard}
        targetLabelById={{ "quiz-lesson-1": "Lesson 1.1: Old quiz" }}
      />,
    );

    const card = screen.getByTestId("course-authoring-proposal-group-request-1");
    expect(card).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Ready to review")).toBeVisible();
    expect(screen.getByText("Removed")).toBeVisible();
    expect(screen.getByText("Lesson 1.1: Old quiz")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(onReview).toHaveBeenLastCalledWith();
    await user.click(screen.getByRole("button", { name: /Lesson 1.1: Old quiz/ }));
    expect(onReview).toHaveBeenLastCalledWith("proposal-a");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalled();
  });

  it("keeps discarded request changes visible as read-only history", () => {
    const { rerender } = renderWith().render(
      <ProposalGroup
        requestId="request-discarded"
        proposals={groupProposals}
        onReview={vi.fn()}
        onDiscard={vi.fn()}
        targetLabelById={{ "quiz-lesson-1": "Lesson 1.1: Old quiz" }}
      />,
    );
    rerender(
      <ProposalGroup
        requestId="request-discarded"
        proposals={groupProposals.map((proposal) => ({ ...proposal, decision: "rejected" }))}
        onReview={vi.fn()}
        onDiscard={vi.fn()}
        targetLabelById={{ "quiz-lesson-1": "Lesson 1.1: Old quiz" }}
      />,
    );

    const card = screen.getByTestId("course-authoring-proposal-group-request-discarded");
    expect(card).toHaveAttribute("data-state", "discarded");
    expect(screen.getByText("Discarded")).toBeVisible();
    expect(screen.getByText("Lesson 1.1: Old quiz")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lesson 1.1: Old quiz/ })).not.toBeInTheDocument();
  });

  it("replaces outline approval with discarded while retaining its chapters", () => {
    const outline = {
      ...attemptedQuizProposal,
      id: "approved-outline",
      decision: "accepted" as const,
      operations: [],
      outline: [{ id: "chapter-1", title: "Getting started", lessons: [] }],
    };
    const { rerender } = renderWith().render(
      <ProposalGroup requestId="discarded-outline" proposals={[outline]} />,
    );
    expect(screen.getByText("Approved")).toBeVisible();
    rerender(
      <ProposalGroup
        requestId="discarded-outline"
        proposals={[{ ...outline, decision: "rejected" }]}
      />,
    );
    expect(screen.getByText("Discarded")).toBeVisible();
    expect(screen.queryByText("Approved")).not.toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeVisible();
    expect(screen.getByText("Course outline")).toBeVisible();
  });

  it("keeps completed changes reviewable while failed terminal siblings leave saved completed changes", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    renderWith().render(
      <ProposalGroup requestId="request-writing" proposals={groupProposals} onReview={onReview} />,
    );

    expect(screen.getByText("Ready to review")).toBeVisible();
    expect(screen.queryByText("Finishing draft")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("keeps already approved content reviewable once sibling generation stops", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    renderWith().render(
      <ProposalGroup
        requestId="request-approved-content"
        proposals={[
          { ...groupProposals[0], decision: "accepted" },
          {
            ...groupProposals[1],
            operations: [],
            outline: [{ id: "chapter", title: "Draft outline", lessons: [] }],
          },
        ]}
        onReview={onReview}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review outline" }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("hides completed content review while related generation is pending", () => {
    const onReview = vi.fn();
    renderWith().render(
      <ProposalGroup
        requestId="still-writing"
        proposals={groupProposals}
        generationPending
        onReview={onReview}
      />,
    );
    expect(screen.getByText("Finishing draft")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Section|Lesson/ })).not.toBeInTheDocument();
    expect(onReview).not.toHaveBeenCalled();
  });

  it("still waits for an incomplete outline without completed content changes", () => {
    renderWith().render(
      <ProposalGroup
        requestId="request-outline-writing"
        proposals={[
          {
            ...groupProposals[0],
            operations: [],
            outline: [{ id: "chapter", title: "Draft outline", lessons: [] }],
          },
        ]}
        generationPending
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Finishing draft")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review changes" })).not.toBeInTheDocument();
  });

  it("closes a superseded iteration while its revision is prepared", () => {
    renderWith().render(
      <ProposalGroup
        requestId="request-revised"
        proposals={groupProposals.map((proposal) => ({
          ...proposal,
          decision: "superseded",
        }))}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Revision requested")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review changes" })).not.toBeInTheDocument();
  });

  it("labels an outline as a planning decision instead of an applicable course change", () => {
    renderWith().render(
      <ProposalGroup
        requestId="outline-request"
        proposals={[
          {
            ...attemptedQuizProposal,
            id: "outline-proposal",
            decision: "pending",
            operations: [],
            outline: [{ id: "chapter-1", title: "Getting started", lessons: [] }],
          },
        ]}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Course outline")).toBeVisible();
    expect(screen.getByText("Getting started")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review outline" })).toBeVisible();
  });

  it("shows an outline as numbered chapters with their lesson titles", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const lessons = ["Welcome", "Your first task", "Check-in quiz", "Next steps", "Wrap-up"].map(
      (title, index) => ({
        id: `lesson-${index}`,
        title,
        lessonType: "content" as const,
        objectives: [],
      }),
    );
    renderWith().render(
      <ProposalGroup
        requestId="outline-request"
        proposals={[
          {
            ...attemptedQuizProposal,
            id: "outline-proposal",
            decision: "pending",
            operations: [],
            outline: [{ id: "chapter-1", title: "Getting started", lessons }],
          },
        ]}
        onReview={onReview}
      />,
    );

    const outline = screen.getByTestId("course-authoring-outline-outline-request");
    expect(outline).toHaveTextContent("1Getting started5 lessons");
    expect(screen.getByText("Welcome")).toBeVisible();
    expect(screen.getByText("Next steps")).toBeVisible();
    expect(screen.queryByText("Wrap-up")).toBeNull();
    expect(screen.getByText("+1 more")).toBeVisible();
    expect(screen.queryByText("New")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Getting started/ }));
    expect(onReview).toHaveBeenCalledWith("outline-proposal");
  });

  it("never presents an approved change as applied before the course is updated", () => {
    renderWith().render(
      <ProposalGroup
        requestId="request-1"
        proposals={[{ ...groupProposals[0], decision: "accepted" as const }]}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Not applied yet")).toBeVisible();
    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and apply" })).toBeVisible();
  });

  it("shows progress while applying and a final state once applied", () => {
    const { rerender } = renderWith().render(
      <ProposalGroup
        requestId="request-1"
        proposals={groupProposals}
        onReview={vi.fn()}
        applicationStatusByProposalId={{ "proposal-a": "applying", "proposal-b": "applying" }}
      />,
    );
    expect(screen.getByText("Applying…")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review changes" })).not.toBeInTheDocument();

    rerender(
      <ProposalGroup
        requestId="request-1"
        proposals={groupProposals}
        onReview={vi.fn()}
        applicationStatusByProposalId={{ "proposal-a": "applied", "proposal-b": "applied" }}
      />,
    );
    expect(screen.getByText("Applied")).toBeVisible();
    expect(
      screen.queryByTestId("course-authoring-review-changes-request-1"),
    ).not.toBeInTheDocument();
  });

  it("offers a retry when applying failed", async () => {
    const user = userEvent.setup();
    const onRetryApply = vi.fn();

    renderWith().render(
      <ProposalGroup
        requestId="request-1"
        proposals={groupProposals}
        onReview={vi.fn()}
        applicationStatusByProposalId={{ "proposal-a": "failed" }}
        onRetryApply={onRetryApply}
      />,
    );

    expect(screen.getByText("Couldn't apply")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryApply).toHaveBeenCalled();
  });

  it("requires an explicit omission for an unavailable optional visual", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const proposal: ProposalView = {
      ...attemptedQuizProposal,
      id: "proposal-assets",
      summary: "Add optional diagram",
      assetRequests: [
        {
          assetId: "asset-1",
          operationId: "operation-asset",
          purpose: "diagram",
          required: false,
          altText: "Safety diagram",
          source: { type: "generated", content: "A safety diagram", visualQuery: "safety" },
        },
      ],
      assetIds: ["asset-1"],
    };

    renderWith().render(
      <ProposalReview
        proposals={[proposal]}
        readyAssetIds={[]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByLabelText("Select Add optional diagram"));
    const applyButton = screen.getByRole("button", { name: "Apply selected" });
    expect(applyButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Omit optional asset Safety diagram" }));
    expect(
      screen.getByRole("checkbox", { name: "Omit optional asset Safety diagram" }),
    ).toBeChecked();
    expect(applyButton).toBeEnabled();
    await user.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(["proposal-assets"], false, ["asset-1"]);
  });

  it("does not offer omission for an unavailable required visual", async () => {
    const user = userEvent.setup();
    const proposal: ProposalView = {
      ...attemptedQuizProposal,
      id: "proposal-required-asset",
      summary: "Add required diagram",
      assetRequests: [
        {
          assetId: "asset-required",
          operationId: "operation-required-asset",
          purpose: "diagram",
          required: true,
          altText: "Required safety diagram",
          source: { type: "generated", content: "A required diagram", visualQuery: "safety" },
        },
      ],
    };

    renderWith().render(
      <ProposalReview
        proposals={[proposal]}
        readyAssetIds={[]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Select Add required diagram"));
    expect(screen.queryByLabelText("Omit optional asset Required safety diagram")).toBeNull();
    expect(screen.getByRole("button", { name: "Apply selected" })).toBeDisabled();
    expect(screen.getByText(/Required asset is not ready/)).toBeVisible();
  });

  it("can leave proposal cards to the owning conversation turn", () => {
    renderWith().render(
      <ProposalReview
        proposals={[attemptedQuizProposal]}
        renderCards={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByText("Remove the old assessment")).not.toBeInTheDocument();
  });
});

it("keeps operation details collapsed until requested and offers curriculum preview", async () => {
  const user = userEvent.setup();
  const onPreviewProposal = vi.fn();
  const proposal = {
    ...attemptedQuizProposal,
    decision: "pending" as const,
    outline: [{ id: "chapter-1", title: "Chapter 1", lessons: [] }],
  };
  renderWith().render(
    <ProposalReview
      compact
      proposals={[proposal]}
      targetLabelById={{ "quiz-lesson-1": "Lesson 1.1: Final exam" }}
      onPreviewProposal={onPreviewProposal}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onRegenerate={vi.fn()}
      onApply={vi.fn()}
    />,
  );

  expect(screen.getByText("Delete lesson")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Remove the old assessment" }));
  expect(screen.getAllByText("Delete lesson")).toHaveLength(3);
  expect(screen.getAllByText(/Lesson 1\.1: Final exam/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Preview in curriculum" }));

  expect(onPreviewProposal).toHaveBeenCalledWith(proposal);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers curriculum preview for pending generated lessons without an outline", async () => {
  const user = userEvent.setup();
  const onPreviewProposal = vi.fn();
  const proposal: ProposalView = {
    ...attemptedQuizProposal,
    decision: "pending",
    outline: null,
    operations: [
      {
        operationId: "chapter-create",
        targetId: "chapter-generated",
        type: "chapter.create",
        displayOrder: 1,
        dependencies: [],
        payload: { title: "Generated chapter", displayOrder: 1 },
      },
      {
        operationId: "lesson-create",
        targetId: "lesson-generated",
        type: "lesson.create",
        chapterId: "chapter-generated",
        displayOrder: 0,
        dependencies: ["chapter-create"],
        payload: { title: "Generated lesson", lessonType: "content" },
      },
    ],
  };
  renderWith().render(
    <ProposalReview
      compact
      proposals={[proposal]}
      onPreviewProposal={onPreviewProposal}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onRegenerate={vi.fn()}
      onApply={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Preview in curriculum" }));

  expect(onPreviewProposal).toHaveBeenCalledWith(proposal);
});

it("keeps follow-up requests beside their results without opening a review dialog", () => {
  renderWith().render(
    <ProposalReview
      compact
      requests={[
        {
          id: "message-1",
          requestId: "request-1",
          instruction: "Replace the assessment",
          createdAt: "2026-09-16T10:00:00Z",
          sourceVersionIds: [],
        },
        {
          id: "message-2",
          requestId: "request-2",
          instruction: "Then shorten chapter two",
          createdAt: "2026-09-16T10:01:00Z",
          sourceVersionIds: [],
        },
      ]}
      tasks={[
        {
          taskId: "task-1",
          requestId: "request-1",
          status: "succeeded",
          errorCode: null,
          outputId: "proposal-1",
        },
      ]}
      proposals={[attemptedQuizProposal]}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onRegenerate={vi.fn()}
      onApply={vi.fn()}
    />,
  );
  const first = screen.getByText("Replace the assessment");
  const result = screen.getByText("Remove the old assessment");
  const followup = screen.getByText("Then shorten chapter two");
  expect(first.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(result.compareDocumentPosition(followup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("course-authoring-proposal-proposal-1")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Preview in curriculum" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});

it("does not show a wizard placeholder or apply toolbar for a chat awaiting its first result", () => {
  renderWith().render(
    <ProposalReview
      compact
      proposals={[]}
      requests={[
        {
          id: "message-1",
          requestId: "request-1",
          instruction: "Create a safety course",
          createdAt: "2026-09-16T10:00:00Z",
          sourceVersionIds: [],
        },
      ]}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onRegenerate={vi.fn()}
      onApply={vi.fn()}
    />,
  );
  expect(screen.getByText("Create a safety course")).toBeVisible();
  expect(screen.queryByText("Drafts will arrive here")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply selected" })).not.toBeInTheDocument();
});

it("can keep request messages in the conversation timeline", () => {
  renderWith().render(
    <ProposalReview
      compact
      showRequests={false}
      proposals={[attemptedQuizProposal]}
      requests={[
        {
          id: "message-1",
          requestId: "request-1",
          instruction: "Create a safety course",
          createdAt: "2026-09-16T10:00:00Z",
          sourceVersionIds: [],
        },
      ]}
      tasks={[
        {
          taskId: "task-1",
          requestId: "request-1",
          status: "succeeded",
          errorCode: null,
          outputId: "proposal-1",
        },
      ]}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      onRegenerate={vi.fn()}
      onApply={vi.fn()}
    />,
  );

  expect(screen.queryByText("Create a safety course")).not.toBeInTheDocument();
  expect(screen.getByText("Remove the old assessment")).toBeVisible();
});
