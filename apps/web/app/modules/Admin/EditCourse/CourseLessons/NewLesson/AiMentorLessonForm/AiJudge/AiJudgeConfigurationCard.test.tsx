import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AI_JUDGE_GENERATION_MODE } from "./aiJudgeConfiguration.types";
import { AiJudgeConfigurationCard } from "./AiJudgeConfigurationCard";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";

const configuredAssessment: AiJudgeConfigurationDraft = {
  taskGoal: "Discover the client's needs",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Needs discovery",
      expectedBehavior: "Asks open questions",
      maxScore: 2,
      scoreGuidance: [],
    },
  ],
  blockingErrors: [],
};

type AiJudgeConfigurationCardOverrides = Partial<
  Omit<React.ComponentProps<typeof AiJudgeConfigurationCard>, "editorOpen" | "onEditorOpenChange">
> &
  (
    | {
        editorOpen: boolean;
        onEditorOpenChange: (open: boolean) => void;
      }
    | {
        editorOpen?: never;
        onEditorOpenChange?: never;
      }
  );

const renderCard = (props: AiJudgeConfigurationCardOverrides = {}) =>
  renderWith().render(
    <TooltipProvider delayDuration={0}>
      <AiJudgeConfigurationCard
        onSaveBaseConfiguration={vi.fn()}
        onSaveTranslation={vi.fn()}
        language="en"
        baseLanguage="en"
        isPersisted={false}
        onConfigureWithAi={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );

describe("AiJudgeConfigurationCard", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("makes AI creation the compact primary empty-state action", async () => {
    const user = userEvent.setup();
    const onConfigureWithAi = vi.fn();
    renderCard({ onConfigureWithAi });

    const aiAction = screen.getByRole("button", { name: "Create with AI" });
    const manualAction = screen.getByRole("button", { name: "Configure manually" });

    expect(aiAction).toHaveClass("h-9", "bg-primary-700");
    expect(manualAction).toHaveClass("text-primary");

    await user.click(aiAction);
    expect(onConfigureWithAi).toHaveBeenCalledWith(AI_JUDGE_GENERATION_MODE.CREATE);
  });

  it("keeps improvement inside the editor for an existing assessment", () => {
    const onConfigureWithAi = vi.fn();
    renderCard({
      value: configuredAssessment,
      isPersisted: true,
      onConfigureWithAi,
    });

    expect(screen.getByRole("button", { name: "Edit assessment" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Improve with AI" })).not.toBeInTheDocument();
    expect(onConfigureWithAi).not.toHaveBeenCalled();
  });

  it("keeps AI creation visible but disabled outside the base language", async () => {
    const user = userEvent.setup();
    renderCard({ language: "pl", baseLanguage: "en" });

    const aiAction = screen.getByRole("button", { name: "Create with AI" });
    expect(aiAction).toBeVisible();
    expect(aiAction).toBeDisabled();

    await user.hover(aiAction.parentElement!);
    const tooltipCopies = await screen.findAllByText(
      "Assessment structure can only be changed in the course base language.",
    );
    expect(tooltipCopies.some((element) => element.getAttribute("role") !== "tooltip")).toBe(true);
  });
});
