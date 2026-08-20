import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AiMentorConfigurationDialog } from "./AiMentorConfigurationDialog";

vi.mock("~/components/RichText/Editor", () => ({
  BaseEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content?: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={content ?? ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));

describe("AiMentorConfigurationDialog", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("keeps mode selection in the dialog and applies a Roleplay configuration", async () => {
    const user = userEvent.setup();
    const onSaveBaseConfiguration = vi.fn();

    renderWith().render(
      <AiMentorConfigurationDialog
        open
        onOpenChange={vi.fn()}
        onSaveBaseConfiguration={onSaveBaseConfiguration}
        onSaveTranslation={vi.fn()}
        language="en"
        baseLanguage="en"
        isPersisted={false}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Roleplay/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Scenario" }),
      "A customer questions an invoice.",
    );
    await user.type(
      screen.getByTestId("curriculum-ai-mentor-configuration-ai-role-input"),
      "Concerned customer",
    );
    await user.type(
      screen.getByTestId("curriculum-ai-mentor-configuration-learner-role-input"),
      "Support representative",
    );
    await user.type(
      screen.getByRole("textbox", { name: "AI character goal" }),
      "Understand the charge",
    );
    await user.click(screen.getByRole("button", { name: "Apply configuration" }));

    expect(onSaveBaseConfiguration).toHaveBeenCalledWith({
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A customer questions an invoice.",
      aiRole: "Concerned customer",
      learnerRole: "Support representative",
      characterGoal: "Understand the charge",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      factsAndConstraints: "",
      openingInstruction: "",
      additionalInstructions: "",
    });
  });

  it("confirms before clearing populated mode-specific fields", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <AiMentorConfigurationDialog
        open
        onOpenChange={vi.fn()}
        value={{
          type: AI_MENTOR_TYPE.ROLEPLAY,
          scenario: "A customer questions an invoice.",
          aiRole: "Concerned customer",
          learnerRole: "Support representative",
          characterGoal: "Understand the charge",
          difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        }}
        onSaveBaseConfiguration={vi.fn()}
        onSaveTranslation={vi.fn()}
        language="en"
        baseLanguage="en"
        isPersisted
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Teacher/ }));

    const confirmationDialog = screen.getByRole("alertdialog", {
      name: "Change Mentor mode?",
    });

    expect(confirmationDialog).toBeVisible();
    expect(confirmationDialog.previousElementSibling).toHaveClass(
      "z-[60]",
      "bg-neutral-950",
      "opacity-40",
    );
    expect(screen.getByText(/clears the current mode-specific fields/)).toBeVisible();
  });

  it("does not restore cleared Teacher fields after switching modes", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <AiMentorConfigurationDialog
        open
        onOpenChange={vi.fn()}
        value={{
          type: AI_MENTOR_TYPE.TEACHER,
          expertise: "Old expertise",
          taskGoal: "<p>Old task goal</p>",
          contentScope: "<p>Old content scope</p>",
          teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
        }}
        onSaveBaseConfiguration={vi.fn()}
        onSaveTranslation={vi.fn()}
        language="en"
        baseLanguage="en"
        isPersisted
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Roleplay/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Teacher/ }));

    expect(screen.getByTestId("curriculum-ai-mentor-configuration-expertise-input")).toHaveValue(
      "",
    );
    expect(screen.getByRole("textbox", { name: "Task goal" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Content scope" })).toHaveValue("");
  });

  it("keeps AI assistance in the bottom toolbar and uses the current unsaved draft", async () => {
    const user = userEvent.setup();
    const validation = {
      passed: false,
      summary: "The scenario needs a more specific constraint.",
      issues: [
        {
          code: "scenario_constraint",
          severity: "warning" as const,
          target: { field: "factsAndConstraints" as const },
          message: "The scenario is underspecified.",
          correction: "Add a firm budget or deadline.",
        },
      ],
    };
    const onValidateConfiguration = vi.fn().mockResolvedValue(validation);
    const onImproveWithAi = vi.fn();

    renderWith().render(
      <AiMentorConfigurationDialog
        open
        onOpenChange={vi.fn()}
        value={{
          type: AI_MENTOR_TYPE.ROLEPLAY,
          scenario: "A customer questions an invoice.",
          aiRole: "Concerned customer",
          learnerRole: "Support representative",
          characterGoal: "Understand the charge",
          difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        }}
        onSaveBaseConfiguration={vi.fn()}
        onSaveTranslation={vi.fn()}
        onValidateConfiguration={onValidateConfiguration}
        onImproveWithAi={onImproveWithAi}
        language="en"
        baseLanguage="en"
        isPersisted
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: "Scenario" }));
    await user.type(
      screen.getByRole("textbox", { name: "Scenario" }),
      "An unsaved invoice dispute.",
    );
    await user.click(screen.getByRole("button", { name: "AI assistance" }));
    await user.click(screen.getByRole("menuitem", { name: "Check quality with AI" }));

    expect(onValidateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: "An unsaved invoice dispute." }),
      expect.any(AbortSignal),
    );
    expect(await screen.findByText("The scenario needs a more specific constraint.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Improve with AI" }));

    expect(onImproveWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AI_MENTOR_TYPE.ROLEPLAY,
        scenario: "An unsaved invoice dispute.",
      }),
      validation,
    );
  });
});
