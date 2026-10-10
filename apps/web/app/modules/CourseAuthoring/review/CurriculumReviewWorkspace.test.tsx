import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { CurriculumReviewWorkspace } from "./CurriculumReviewWorkspace";

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useParams: () => ({ id: "course-1" }),
}));

vi.mock("~/context/LeaveModalContext", () => ({
  useLeaveModal: () => ({
    openLeaveModal: vi.fn(),
    isCurrentFormDirty: false,
    setIsLeavingContent: vi.fn(),
    setIsCurrectFormDirty: vi.fn(),
  }),
}));

import type { ReviewProposal } from "./curriculumReview.types";
import type { CurriculumPreview } from "../courseAuthoring.types";
import type { Chapter } from "~/modules/Admin/EditCourse/EditCourse.types";

const chapters = [
  {
    id: "c1",
    title: "Basics",
    displayOrder: 0,
    isFree: false,
    lessonCount: 2,
    updatedAt: "2026-01-01T00:00:00.000Z",
    lessons: [
      {
        id: "l1",
        title: "Intro",
        type: "content",
        displayOrder: 0,
        description: '<p data-authoring-block-id="b1">Welcome to the course</p>',
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "l2",
        title: "Old tips",
        type: "content",
        displayOrder: 1,
        description: "<p>Tips</p>",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
] as unknown as Chapter[];

const proposal = (id: string, operationIds: string[], summary: string): ReviewProposal => ({
  id,
  summary,
  rationale: "",
  warnings: [],
  blockedQuality: false,
  decision: "pending",
  operationIds,
  dependsOnProposalIds: [],
  courseLevel: false,
});

const preview: CurriculumPreview = {
  proposalId: "request-1",
  status: "pending",
  outline: [],
  operations: [
    {
      operationId: "op-edit",
      targetId: "l1",
      type: "lesson.block.replace",
      dependencies: [],
      payload: { blockId: "b1", html: '<p data-authoring-block-id="b1">Welcome to Mentingo</p>' },
    },
    {
      operationId: "op-delete",
      targetId: "l2",
      type: "lesson.delete",
      dependencies: [],
      payload: {},
    },
  ],
  proposals: [
    proposal("p-edit", ["op-edit"], "Rewrite the welcome"),
    proposal("p-delete", ["op-delete"], "Drop the tips lesson"),
  ],
};

const renderWorkspace = (
  applyReview = vi.fn().mockResolvedValue(undefined),
  reviewPreview = preview,
  refineBatch?: (feedbacks: Array<{ proposalId: string; feedback: string }>) => Promise<void>,
) => {
  const onApplied = vi.fn();
  const onExit = vi.fn();
  renderWith({ withQuery: true }).render(
    <CurriculumReviewWorkspace
      chapters={chapters}
      preview={reviewPreview}
      actions={{ applyReview, ...(refineBatch ? { refineBatch } : {}) }}
      language="en"
      baseLanguage="en"
      onExit={onExit}
      onApplied={onApplied}
    />,
  );
  return { applyReview, onApplied, onExit };
};

describe("CurriculumReviewWorkspace", () => {
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

  it("marks changes in the tree and keeps removed lessons visible", () => {
    renderWorkspace();

    const tree = screen.getByTestId("course-authoring-review-tree");
    expect(
      within(screen.getByTestId("curriculum-lesson-card-l1")).getByText("Edited"),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("curriculum-lesson-card-l2")).getByText("Removed"),
    ).toBeVisible();
    expect(within(tree).getByText("Old tips")).toBeVisible();
    expect(
      within(screen.getByTestId("course-authoring-review-bar")).getByText("1 of 2"),
    ).toBeVisible();
  });

  it("shows the proposed lesson in the native editor, read-only", async () => {
    renderWorkspace();

    const form = screen.getByTestId("course-authoring-review-native-form");
    expect(form).toHaveAttribute("aria-readonly", "true");
    const title = within(form).getByDisplayValue("Intro");
    expect(title).toHaveAttribute("readonly");
    await userEvent.setup().type(title, " changed");
    expect(title).toHaveValue("Intro");
  });

  it("resolves ready generated images after the native form first renders", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const imageHtml = `<p>Review this diagram.</p><img data-authoring-asset-id="${assetId}" alt="Prepared diagram">`;
    const reviewPreview: CurriculumPreview = {
      ...preview,
      authoringSessionId: "session-1",
      readyAssetIds: [assetId],
      operations: [
        {
          ...preview.operations![0],
          payload: { blockId: "b1", html: imageHtml },
        },
        preview.operations![1],
      ],
    };
    let releasePreview!: (response: { data: Blob }) => void;
    const previewResponse = new Promise<{ data: Blob }>((resolve) => {
      releasePreview = resolve;
    });
    const previewAsset = vi
      .spyOn(ApiClient.api, "courseAuthoringControllerPreviewAuthoringAsset")
      .mockReturnValue(previewResponse as never);
    const createObjectUrl = vi.fn(() => "blob:authoring-preview");
    const revokeObjectUrl = vi.fn();
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

    const rendered = renderWith({ withQuery: true }).render(
      <CurriculumReviewWorkspace
        chapters={chapters}
        preview={reviewPreview}
        actions={{ applyReview: vi.fn() }}
        courseId="course-1"
        language="en"
        baseLanguage="en"
        onExit={vi.fn()}
        onApplied={vi.fn()}
      />,
    );

    try {
      await waitFor(() => expect(previewAsset).toHaveBeenCalledOnce());
      expect(
        document.querySelector('[data-node-type="image"][data-src="blob:authoring-preview"]'),
      ).not.toBeInTheDocument();
      await act(async () => {
        releasePreview({ data: new Blob(["image"], { type: "image/png" }) });
      });
      await waitFor(() =>
        expect(
          document.querySelector('[data-node-type="image"][data-src="blob:authoring-preview"]'),
        ).toBeInTheDocument(),
      );
      expect(reviewPreview.operations?.[0].payload.html).toBe(imageHtml);
    } finally {
      rendered.unmount();
      previewAsset.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:authoring-preview");
  });

  it("shows a failed preview with a retry action without regenerating the image", async () => {
    const assetId = "33333333-3333-4333-8333-333333333333";
    const previewAsset = vi
      .spyOn(ApiClient.api, "courseAuthoringControllerPreviewAuthoringAsset")
      .mockRejectedValueOnce(
        new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 403,
        } as never),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    const rendered = renderWith({ withQuery: true }).render(
      <CurriculumReviewWorkspace
        chapters={chapters}
        preview={{
          ...preview,
          authoringSessionId: "failed-preview-session",
          readyAssetIds: [assetId],
          operations: [
            {
              ...preview.operations![0],
              payload: {
                blockId: "b1",
                html: `<img data-authoring-asset-id="${assetId}" alt="Diagram">`,
              },
            },
          ],
        }}
        actions={{ applyReview: vi.fn() }}
        courseId="course-1"
        language="en"
        baseLanguage="en"
        onExit={vi.fn()}
        onApplied={vi.fn()}
      />,
    );

    try {
      expect(await screen.findByText("Some image previews could not be loaded.")).toBeVisible();
      expect(previewAsset).toHaveBeenCalledTimes(1);
      await userEvent.setup().click(screen.getByRole("button", { name: "Retry previews" }));
      await waitFor(() => expect(previewAsset).toHaveBeenCalledTimes(2));
      expect(previewAsset.mock.calls[1].slice(0, 4)).toEqual([
        "course-1",
        "failed-preview-session",
        assetId,
        { revision: 1 },
      ]);
    } finally {
      rendered.unmount();
      previewAsset.mockRestore();
    }
  });

  it("shows a word-level diff for the selected block edit", async () => {
    renderWorkspace();
    await userEvent.setup().click(screen.getByRole("tab", { name: "What changed" }));

    const detail = screen.getByTestId("course-authoring-review-detail");
    expect(within(detail).getByText("Mentingo")).toHaveClass("bg-success-100");
    expect(within(detail).getByText("the course")).toHaveClass("line-through");
  });

  it("applies every proposed change in one batch", async () => {
    const { applyReview, onApplied } = renderWorkspace();

    await userEvent.setup().click(screen.getByTestId("course-authoring-review-apply"));

    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: ["p-edit", "p-delete"],
      rejectedProposalIds: [],
      acknowledgeAssessmentChanges: false,
    });
    expect(onApplied).toHaveBeenCalled();
  });

  it("describes outline approval as starting lesson drafting", async () => {
    const outlinePreview: CurriculumPreview = {
      ...preview,
      proposalId: "outline-proposal",
      operations: [],
      outline: [{ id: "new-chapter", title: "New chapter", lessons: [] }],
      proposals: [proposal("outline-proposal", [], "Proposed course outline")],
    };
    const { applyReview, onExit, onApplied } = renderWorkspace(
      vi.fn().mockResolvedValue(undefined),
      outlinePreview,
    );

    expect(screen.getByRole("region", { name: "Review course outline" })).toBeVisible();
    expect(screen.getByText("Review the structure before lesson writing starts.")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve outline" }));
    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: ["outline-proposal"],
      rejectedProposalIds: [],
      acknowledgeAssessmentChanges: false,
    });
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("confirms assessed-content impact only after an explicit apply decision", async () => {
    const user = userEvent.setup();
    const applyReview = vi.fn().mockResolvedValue(undefined);
    const { onApplied, onExit } = renderWorkspace(applyReview, {
      ...preview,
      assessedLessonIds: ["l2"],
    });

    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(
      screen.getByRole("dialog", { name: "Existing quiz attempts and scores are affected" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("dialog")).getByText(
        "The selected update follows the same behavior as a manual quiz change. I reviewed this learner impact.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "Acknowledge impact on existing quiz attempts" }),
    ).not.toBeInTheDocument();
    expect(applyReview).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(applyReview).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: ["p-edit", "p-delete"],
      rejectedProposalIds: [],
      acknowledgeAssessmentChanges: true,
    });
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it("keeps impact confirmation open after application fails", async () => {
    const user = userEvent.setup();
    const applyReview = vi.fn().mockRejectedValue(new Error("Apply failed"));
    const { onApplied } = renderWorkspace(applyReview, {
      ...preview,
      assessedLessonIds: ["l2"],
    });

    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    await waitFor(() => expect(applyReview).toHaveBeenCalledOnce());
    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: ["p-edit", "p-delete"],
      rejectedProposalIds: [],
      acknowledgeAssessmentChanges: true,
    });
    expect(
      screen.getByRole("dialog", { name: "Existing quiz attempts and scores are affected" }),
    ).toBeVisible();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("submits one review request for the whole draft", async () => {
    const user = userEvent.setup();
    const refineBatch = vi.fn().mockResolvedValue(undefined);
    const { onExit } = renderWorkspace(vi.fn().mockResolvedValue(undefined), preview, refineBatch);

    expect(
      screen.queryByRole("textbox", { name: "What should the AI change?" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request changes" }));
    expect(screen.getByRole("dialog", { name: "What should the AI change?" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Apply changes" })).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "What should the AI change?" }),
      "Add an example",
    );
    await user.keyboard("{Enter}");
    await user.type(
      screen.getByRole("textbox", { name: "What should the AI change?" }),
      "Keep the tips lesson",
    );
    expect(refineBatch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Revise draft" }));

    await waitFor(() =>
      expect(refineBatch).toHaveBeenCalledWith([
        { proposalId: "p-edit", feedback: "Add an example\n\nKeep the tips lesson" },
        { proposalId: "p-delete", feedback: "Add an example\n\nKeep the tips lesson" },
      ]),
    );
    expect(onExit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request changes" }));
    expect(screen.getByText("0/2000")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "What should the AI change?" })).toHaveTextContent(
      /^$/,
    );
  });

  it("rejects empty and overlong rich-text revision feedback", async () => {
    const user = userEvent.setup();
    const refineBatch = vi.fn().mockResolvedValue(undefined);
    renderWorkspace(vi.fn().mockResolvedValue(undefined), preview, refineBatch);

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const feedback = screen.getByRole("textbox", { name: "What should the AI change?" });
    const submit = screen.getByRole("button", { name: "Revise draft" });
    expect(submit).toBeDisabled();

    await user.type(feedback, "   ");
    expect(submit).toBeDisabled();
    await user.clear(feedback);
    await user.paste("x".repeat(2001));

    expect(screen.getByText("2001/2000")).toBeVisible();
    expect(submit).toBeDisabled();
    expect(refineBatch).not.toHaveBeenCalled();
  });

  it("keeps failed revision feedback open and clears it when canceled", async () => {
    const user = userEvent.setup();
    const refineBatch = vi.fn().mockRejectedValue(new Error("Revision failed"));
    renderWorkspace(vi.fn().mockResolvedValue(undefined), preview, refineBatch);

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const feedback = screen.getByRole("textbox", { name: "What should the AI change?" });
    await user.type(feedback, "Keep the examples");
    await user.click(screen.getByRole("button", { name: "Revise draft" }));

    await waitFor(() => expect(refineBatch).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "What should the AI change?" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "What should the AI change?" })).toHaveTextContent(
      "Keep the examples",
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request changes" }));
    expect(screen.getByRole("textbox", { name: "What should the AI change?" })).toHaveTextContent(
      "",
    );
  });

  it("blocks dialog dismissal and duplicate revision requests while pending", async () => {
    const user = userEvent.setup();
    let resolveRevision!: () => void;
    const refineBatch = vi.fn(
      (_feedbacks: Array<{ proposalId: string; feedback: string }>) =>
        new Promise<void>((resolve) => {
          resolveRevision = resolve;
        }),
    );
    const { onExit } = renderWorkspace(vi.fn().mockResolvedValue(undefined), preview, refineBatch);

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    await user.type(
      screen.getByRole("textbox", { name: "What should the AI change?" }),
      "Keep the examples",
    );
    await user.click(screen.getByRole("button", { name: "Revise draft" }));
    await waitFor(() => expect(refineBatch).toHaveBeenCalledOnce());

    expect(screen.getByRole("button", { name: "Revise draft" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Revise draft" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "What should the AI change?" })).toBeVisible();
    expect(onExit).not.toHaveBeenCalled();
    expect(refineBatch).toHaveBeenCalledOnce();

    resolveRevision();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("discards the whole proposal in one step", async () => {
    const { applyReview, onApplied } = renderWorkspace();

    await userEvent.setup().click(screen.getByRole("button", { name: "Discard" }));

    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: [],
      rejectedProposalIds: ["p-edit", "p-delete"],
      acknowledgeAssessmentChanges: false,
    });
    expect(onApplied).toHaveBeenCalled();
  });

  it("shows quality warnings without requiring an acknowledgement", async () => {
    const applyReview = vi.fn().mockResolvedValue(undefined);
    renderWorkspace(applyReview, {
      ...preview,
      proposals: [
        { ...preview.proposals![0], blockedQuality: true, warnings: ["Add a worked example"] },
      ],
    });

    await userEvent.setup().click(screen.getByText("Quality notes: 1"));
    expect(screen.getByText("Add a worked example")).toBeVisible();
    expect(screen.queryByText("Accept the educational concerns")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId("course-authoring-review-apply"));
    expect(applyReview).toHaveBeenCalledWith({
      acceptedProposalIds: ["p-edit"],
      rejectedProposalIds: [],
      acknowledgeAssessmentChanges: false,
    });
  });

  it("moves between changes with the keyboard", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const bar = screen.getByTestId("course-authoring-review-bar");

    await user.keyboard("j");
    expect(within(bar).getByText("2 of 2")).toBeVisible();
    await user.keyboard("k");
    expect(within(bar).getByText("1 of 2")).toBeVisible();
  });
});
