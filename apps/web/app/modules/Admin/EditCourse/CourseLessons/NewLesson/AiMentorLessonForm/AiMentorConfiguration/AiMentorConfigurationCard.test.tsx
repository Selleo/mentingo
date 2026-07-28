import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AiMentorConfigurationCard } from "./AiMentorConfigurationCard";

import type { AiMentorConfigurationDraft } from "./aiMentorConfiguration.types";

const roleplayConfiguration: AiMentorConfigurationDraft = {
  type: AI_MENTOR_TYPE.ROLEPLAY,
  scenario: "An unexpected invoice",
  aiRole: "Concerned customer",
  learnerRole: "Support representative",
  characterGoal: "Receive a clear next step",
  difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
};

const renderCard = (props: Partial<React.ComponentProps<typeof AiMentorConfigurationCard>> = {}) =>
  renderWith().render(
    <TooltipProvider delayDuration={0}>
      <AiMentorConfigurationCard
        onSaveBaseConfiguration={vi.fn()}
        onSaveTranslation={vi.fn()}
        language="en"
        baseLanguage="en"
        isPersisted={false}
        {...props}
      />
    </TooltipProvider>,
  );

describe("AiMentorConfigurationCard", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("opens the manual configuration dialog from the empty state", async () => {
    const user = userEvent.setup();
    renderCard();

    const manualAction = screen.getByRole("button", { name: "Configure manually" });
    expect(manualAction).toHaveClass("text-primary", "px-1.5");

    await user.click(manualAction);

    expect(screen.getByRole("dialog", { name: "Configure AI Mentor" })).toBeVisible();
    expect(screen.getByText("Mentor mode")).toBeVisible();
  });

  it("summarizes a configured Roleplay", () => {
    renderCard({ value: roleplayConfiguration, isPersisted: true });

    expect(screen.getByText("Roleplay · Concerned customer · Realistic")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review configuration" })).toBeVisible();
  });

  it("requires the base configuration before opening a translation", () => {
    renderCard({ language: "pl", baseLanguage: "en", isPersisted: true });

    expect(screen.getByRole("button", { name: "Configure manually" })).toBeDisabled();
    expect(
      screen.getByText(
        "Configure AI Mentor behavior in the course base language before translating it.",
      ),
    ).toBeVisible();
  });

  it("shows migrated incomplete configurations as an error state", () => {
    const { container } = renderCard({
      value: roleplayConfiguration,
      isPersisted: true,
      needsConfiguration: true,
    });

    expect(
      screen.getByText(
        "This configuration needs a few details before it can be edited or translated.",
      ),
    ).toBeVisible();
    expect(container.querySelector(".border-error-500")).toBeInTheDocument();
  });
});
