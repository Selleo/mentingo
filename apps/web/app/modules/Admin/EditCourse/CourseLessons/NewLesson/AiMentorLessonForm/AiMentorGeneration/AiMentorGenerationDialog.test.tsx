import {
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AI_MENTOR_GENERATION_MODE } from "./aiMentorGeneration.types";
import { AiMentorGenerationDialog } from "./AiMentorGenerationDialog";

import type { AiMentorGenerationViewState } from "./aiMentorGeneration.types";

vi.mock("~/components/RichText/Editor", () => ({
  BaseEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("AiMentorGenerationDialog", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("uses the creator-selected type as trusted request context", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const onSelectedTypeChange = vi.fn();
    renderWith().render(
      <AiMentorGenerationDialog
        open
        onOpenChange={vi.fn()}
        mode={AI_MENTOR_GENERATION_MODE.CREATE}
        selectedType={AI_MENTOR_TYPE.TEACHER}
        onSelectedTypeChange={onSelectedTypeChange}
        onGenerate={onGenerate}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Roleplay/ }));
    expect(onSelectedTypeChange).toHaveBeenCalledWith(AI_MENTOR_TYPE.ROLEPLAY);

    await user.type(
      screen.getByRole("textbox", { name: "What scenario should AI prepare?" }),
      "Teach GDPR.",
    );
    await user.click(screen.getByRole("button", { name: "Generate draft" }));

    expect(onGenerate).toHaveBeenCalledWith({
      mode: AI_MENTOR_GENERATION_MODE.CREATE,
      brief: "Teach GDPR.",
      configurationType: AI_MENTOR_TYPE.TEACHER,
    });
  });

  it("puts Roleplay first and shows the selected mode choices", () => {
    renderWith().render(
      <AiMentorGenerationDialog
        open
        onOpenChange={vi.fn()}
        mode={AI_MENTOR_GENERATION_MODE.CREATE}
        selectedType={AI_MENTOR_TYPE.ROLEPLAY}
        onSelectedTypeChange={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    const choices = screen.getAllByRole("radio");
    expect(choices[0]).toHaveAccessibleName(/^Roleplay/);
    expect(choices[1]).toHaveAccessibleName(/^Teacher/);
  });

  it("matches the quality-decision and review steps used by completion conditions", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const state = {
      generationId: "generation-1",
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
      type: AI_MENTOR_TYPE.ROLEPLAY,
      attempt: 1,
      maxAttempts: 3,
      draft: {
        type: AI_MENTOR_TYPE.ROLEPLAY,
        scenario: "An invoice dispute",
        aiRole: "Customer",
        learnerRole: "Support representative",
        characterGoal: "Receive a clear answer",
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      },
      changes: [
        {
          field: "scenario",
          before: "A complaint",
          after: "An invoice dispute",
        },
      ],
      quality: {
        passed: false,
        summary: "One improvement is suggested.",
        findings: [
          {
            code: "missing_constraint",
            field: "factsAndConstraints",
            message: "The scenario needs a firm constraint.",
            correction: "Add a deadline.",
          },
        ],
      },
    } satisfies AiMentorGenerationViewState;

    renderWith().render(
      <AiMentorGenerationDialog
        open
        onOpenChange={vi.fn()}
        mode={AI_MENTOR_GENERATION_MODE.IMPROVE}
        selectedType={AI_MENTOR_TYPE.ROLEPLAY}
        onSelectedTypeChange={vi.fn()}
        currentConfiguration={state.draft}
        state={state}
        onGenerate={vi.fn()}
        onRevise={vi.fn()}
        onReview={onReview}
      />,
    );

    expect(screen.getByText("Generating draft")).toBeVisible();
    expect(screen.getAllByText("Quality check")).toHaveLength(2);
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.getByText("The scenario needs a firm constraint.")).toBeVisible();
    expect(screen.getByTestId("ai-mentor-generation-quality-footer")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Review the current draft")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review configuration" }));
    expect(onReview).toHaveBeenCalledWith(state);
  });
});
