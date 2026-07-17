import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
      onApplyDraft={vi.fn()}
      {...props}
    />,
  );

describe("AiJudgeGenerationDialog", () => {
  it("collects one focused brief and submits a create request", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderDialog(undefined, { onGenerate });

    expect(screen.getByRole("dialog", { name: "Create assessment with AI" })).toBeVisible();
    expect(screen.queryByText(/attachment/i)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

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

    expect(screen.getByText("Attempt 2 of 3")).toBeVisible();
    expect(screen.getByText("Clarifying what earns a partial score.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop and inspect current draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel generation" })).toBeVisible();
  });

  it("keeps a requires-review draft and applies it only through the callback", async () => {
    const user = userEvent.setup();
    const onApplyDraft = vi.fn();
    renderDialog(
      createState({
        status: AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW,
        attempt: 3,
        remainingConcern: "The partial-score guidance still overlaps with the full score.",
        draft,
      }),
      { onApplyDraft },
    );

    expect(screen.getByText("Draft requires your decision")).toBeVisible();
    expect(
      screen.getByText("The partial-score guidance still overlaps with the full score."),
    ).toBeVisible();
    expect(screen.getByText("Nothing has been saved or published automatically.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Apply draft" }));
    expect(onApplyDraft).toHaveBeenCalledWith(draft);
  });
});
