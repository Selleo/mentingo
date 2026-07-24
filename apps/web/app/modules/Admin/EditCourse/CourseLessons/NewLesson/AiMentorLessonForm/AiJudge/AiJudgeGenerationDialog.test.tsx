import { AI_JUDGE_DRAFT_CHANGE_FIELD, AI_JUDGE_DRAFT_CHANGE_TYPE } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import {
  AI_JUDGE_GENERATION_CHECK_STATUS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "./aiJudgeConfiguration.types";
import { AiJudgeGenerationDialog } from "./AiJudgeGenerationDialog";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationViewState,
} from "./aiJudgeConfiguration.types";

vi.mock("~/components/RichText/Editor", () => ({
  BaseEditor: ({
    content,
    onChange,
    ariaLabel,
    placeholder,
  }: {
    content?: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={content ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const draft: AiJudgeConfigurationDraft = {
  taskGoal: "Discover the client's needs and agree on a next step",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Needs discovery",
      expectedBehavior: "Asks open questions",
      maxScore: 2,
      scoreGuidance: [],
    },
  ],
  blockingErrors: [{ description: "Invents product capabilities" }],
};

const createState = (
  overrides: Partial<AiJudgeGenerationViewState> = {},
): AiJudgeGenerationViewState => ({
  status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
  attempt: 1,
  maxAttempts: 3,
  completedArtifacts: [],
  evaluatorChecks: [],
  changes: [],
  attemptHistory: [],
  ...overrides,
});

const renderDialog = (
  state?: AiJudgeGenerationViewState,
  props: Partial<React.ComponentProps<typeof AiJudgeGenerationDialog>> = {},
) =>
  renderWith().render(
    <AiJudgeGenerationDialog
      open
      onOpenChange={vi.fn()}
      mode={AI_JUDGE_GENERATION_MODE.CREATE}
      state={state}
      onGenerate={vi.fn()}
      onRevise={vi.fn()}
      onReviewAssessment={vi.fn()}
      {...props}
    />,
  );

describe("AiJudgeGenerationDialog", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("uses singular and plural wording for quality-check findings", () => {
    const key = "adminCourseView.curriculum.lesson.aiJudge.generation.qualityDecisionTitle";

    expect(i18next.t(key, { count: 1 })).toBe("1 improvement suggested");
    expect(i18next.t(key, { count: 2 })).toBe("2 improvements suggested");
  });

  it("collects one focused brief and submits a create request", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderDialog(undefined, { onGenerate });

    expect(screen.getByRole("dialog", { name: "Create assessment with AI" })).toBeVisible();
    expect(
      screen.queryByText(
        "Describe what a good learner response should achieve. You can review and edit the draft before applying it.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("AI will generate")).toBeVisible();
    expect(screen.getByText("- A measurable task goal")).toBeVisible();
    expect(screen.queryByText(/attachment/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(screen.getByText("Describe what you want AI to create or improve")).toBeVisible();

    await user.type(
      screen.getByRole("textbox", { name: /What should the learner demonstrate?/ }),
      "The learner should discover the client's needs.",
    );
    await user.click(screen.getByRole("button", { name: "Generate draft" }));

    expect(onGenerate).toHaveBeenCalledWith({
      mode: AI_JUDGE_GENERATION_MODE.CREATE,
      instruction: "The learner should discover the client's needs.",
    });
  });

  it("shows real revision progress and exposes inspect and cancel actions", () => {
    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.REVISING,
        attempt: 2,
        completedArtifacts: ["Task goal", "Passing threshold"],
        evaluatorChecks: [
          {
            id: "measurable",
            label: "Goal is measurable",
            status: AI_JUDGE_GENERATION_CHECK_STATUS.PASSED,
          },
          {
            id: "guidance",
            label: "Scoring guidance is coherent",
            status: AI_JUDGE_GENERATION_CHECK_STATUS.IN_PROGRESS,
          },
        ],
        currentCorrection: "Clarifying what earns a partial score.",
        draft,
      }),
      { onCancel: vi.fn(), onStopAndInspect: vi.fn() },
    );

    expect(screen.getByText("Draft 2 of 3")).toBeVisible();
    expect(screen.getByText("Clarifying what earns a partial score.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop and inspect current draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel generation" })).toBeVisible();
  });

  it("keeps a requires-review draft and opens it for review", async () => {
    const user = userEvent.setup();
    const onReviewAssessment = vi.fn();
    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW,
        attempt: 3,
        remainingConcern: "The partial-score guidance still overlaps with the full score.",
        draft,
      }),
      { onReviewAssessment },
    );

    expect(screen.getByText("Draft requires your decision")).toBeVisible();
    expect(
      screen.getByText("The partial-score guidance still overlaps with the full score."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review assessment" }));
    expect(onReviewAssessment).toHaveBeenCalledWith(draft);
  });

  it("keeps the ready view focused on the generated assessment", () => {
    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
        draft,
      }),
    );

    expect(screen.queryByText("Draft passed the quality check")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Review the assessment before applying it to the lesson form."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review assessment" })).toBeVisible();
  });

  it("keeps quality findings compact and discloses details and exact changes on demand", async () => {
    const user = userEvent.setup();
    const onReviewAssessment = vi.fn();
    const evaluatorChecks = Array.from({ length: 3 }, (_, index) => ({
      id: `finding-${index}`,
      label: `Finding ${index + 1}`,
      detail: `Correction ${index + 1}`,
      status: AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
    }));

    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION,
        evaluatorChecks,
        draft,
        changes: [
          {
            type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
            targetRef: "C1",
            field: AI_JUDGE_DRAFT_CHANGE_FIELD.EXPECTED_BEHAVIOR,
            before: "Ask questions",
            after: "Ask two open questions about the client's needs",
          },
        ],
      }),
      { onReviewAssessment },
    );

    expect(screen.getByText("3 improvements suggested")).toBeVisible();
    expect(screen.getByText("Suggested improvements")).toBeVisible();
    expect(screen.queryByText("Finding 3")).not.toBeInTheDocument();
    expect(screen.getByText("Correction 1")).toBeVisible();
    expect(screen.getByText("Correction 3")).toBeVisible();
    expect(screen.queryByText("Previous assessment")).not.toBeInTheDocument();

    const changesDisclosure = screen.getByText("What AI changed (1)").closest("details");
    expect(changesDisclosure).not.toBeNull();
    await user.click(screen.getByText("What AI changed (1)"));
    expect(changesDisclosure).toHaveTextContent("Ask two open questions about the client's needs");
    expect(changesDisclosure?.querySelector("ins")).toHaveTextContent("two open");

    const body = screen.getByTestId("ai-judge-generation-dialog-body");
    const footer = screen.getByTestId("ai-judge-generation-quality-footer");
    expect(body).not.toContainElement(footer);
    expect(screen.queryByRole("button", { name: "Edit manually" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Revise" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Current draft is ready for review")).toBeVisible();
    expect(onReviewAssessment).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Review assessment" }));
    expect(onReviewAssessment).toHaveBeenCalledWith(draft);
  });

  it("prevents another revision request while one is starting", () => {
    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION,
        draft,
      }),
      { isRevising: true },
    );

    expect(screen.getByRole("button", { name: "Revise" })).toBeDisabled();
  });
});
