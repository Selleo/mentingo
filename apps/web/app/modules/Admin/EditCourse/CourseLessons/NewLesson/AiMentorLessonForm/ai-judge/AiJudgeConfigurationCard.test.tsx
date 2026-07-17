import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import { renderWith } from "~/utils/testUtils";

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

const renderCard = (props: Partial<React.ComponentProps<typeof AiJudgeConfigurationCard>> = {}) =>
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
  it("makes AI the primary empty-state action and keeps manual setup quiet", async () => {
    const user = userEvent.setup();
    const onConfigureWithAi = vi.fn();
    renderCard({ onConfigureWithAi });

    const aiAction = screen.getByRole("button", { name: "Create assessment with AI" });
    const manualAction = screen.getByRole("button", { name: "Configure manually" });

    expect(aiAction).toHaveClass("bg-primary-700");
    expect(manualAction).toHaveClass("text-primary");

    await user.click(aiAction);
    expect(onConfigureWithAi).toHaveBeenCalledWith("create");
  });

  it("makes editing primary and improvement secondary for an existing assessment", async () => {
    const user = userEvent.setup();
    const onConfigureWithAi = vi.fn();
    renderCard({
      value: configuredAssessment,
      isPersisted: true,
      onConfigureWithAi,
    });

    expect(screen.getByRole("button", { name: "Edit assessment" })).toHaveClass("bg-primary-700");
    expect(screen.getByRole("button", { name: "Improve with AI" })).toHaveClass("border");

    await user.click(screen.getByRole("button", { name: "Improve with AI" }));
    expect(onConfigureWithAi).toHaveBeenCalledWith("improve");
  });

  it("keeps AI creation visible but disabled outside the base language", async () => {
    const user = userEvent.setup();
    renderCard({ language: "pl", baseLanguage: "en" });

    const aiAction = screen.getByRole("button", { name: "Create assessment with AI" });
    expect(aiAction).toBeVisible();
    expect(aiAction).toBeDisabled();

    await user.hover(aiAction.parentElement!);
    const tooltipCopies = await screen.findAllByText(
      "Assessment structure can only be changed in the course base language.",
    );
    expect(tooltipCopies.some((element) => element.getAttribute("role") !== "tooltip")).toBe(true);
  });
});
