import { fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import { renderWith } from "~/utils/testUtils";

import { AiJudgeConfigurationDialog } from "./AiJudgeConfigurationDialog";

import type { FormEvent } from "react";

describe("AiJudgeConfigurationDialog criterion accordion", () => {
  it("applies a new-lesson configuration without submitting the outer lesson form", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onOuterSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onOpenChange = vi.fn();

    renderWith().render(
      <form onSubmit={onOuterSubmit}>
        <TooltipProvider>
          <AiJudgeConfigurationDialog
            open
            onOpenChange={onOpenChange}
            value={{
              taskGoal: "Handle the conversation",
              passingThresholdPercent: 70,
              criteria: [],
              blockingErrors: [],
            }}
            onSaveBaseConfiguration={onApply}
            onSaveTranslation={vi.fn()}
            language="en"
            baseLanguage="en"
            isPersisted={false}
          />
        </TooltipProvider>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Apply configuration" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onOuterSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a new criterion once and preserves its values across manual collapse", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <TooltipProvider>
        <AiJudgeConfigurationDialog
          open
          onOpenChange={vi.fn()}
          onSaveBaseConfiguration={vi.fn()}
          onSaveTranslation={vi.fn()}
          language="en"
          baseLanguage="en"
          isPersisted={false}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Apply configuration" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Add your first criterion" }));

    const trigger = screen.getByRole("button", { name: /Untitled criterion/ });
    const titleInput = screen.getByLabelText("Criterion title");

    expect(trigger).toHaveAttribute("data-state", "open");
    expect(titleInput).toBeVisible();

    await user.type(titleInput, "Discovery");
    await user.click(trigger);

    expect(trigger).toHaveAttribute("data-state", "closed");
    expect(titleInput).not.toBeVisible();
    expect(titleInput).toHaveValue("Discovery");

    fireEvent.change(screen.getByLabelText("Task goal"), {
      target: { value: "Trigger an unrelated RHF watch rerender" },
    });

    await waitFor(() => expect(trigger).toHaveAttribute("data-state", "closed"));

    await user.click(trigger);

    expect(trigger).toHaveAttribute("data-state", "open");
    const reopenedTitleInput = screen.getByLabelText("Criterion title");
    expect(reopenedTitleInput).toBeVisible();
    expect(reopenedTitleInput).toHaveValue("Discovery");
  });

  it("keeps structural actions visible but disabled in translation mode", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <TooltipProvider delayDuration={0}>
        <AiJudgeConfigurationDialog
          open
          onOpenChange={vi.fn()}
          value={{
            taskGoal: "Obsłuż rozmowę",
            passingThresholdPercent: 70,
            criteria: [
              {
                id: "00000000-0000-4000-8000-000000000001",
                title: "Rozpoznanie potrzeb",
                expectedBehavior: "Zadaje pytania otwarte",
                maxScore: 2,
                scoreGuidance: [],
              },
            ],
            blockingErrors: [
              {
                id: "00000000-0000-4000-8000-000000000002",
                description: "Zmyśla fakty",
              },
            ],
          }}
          onSaveBaseConfiguration={vi.fn()}
          onSaveTranslation={vi.fn()}
          language="pl"
          baseLanguage="en"
          isPersisted
        />
      </TooltipProvider>,
    );

    const addCriterion = screen.getByRole("button", { name: "Add criterion" });
    const addBlockingError = screen.getByRole("button", { name: "Add blocking error" });

    expect(addCriterion).toBeVisible();
    expect(addCriterion).toBeDisabled();
    await user.click(screen.getByText("Blocking errors").closest("summary")!);
    expect(addBlockingError).toBeVisible();
    expect(addBlockingError).toBeDisabled();
    expect(
      screen.queryByText("You can translate assessment text here.", { exact: false }),
    ).toBeNull();

    await user.hover(addCriterion.parentElement!);
    const tooltipCopies = await screen.findAllByText(
      "Assessment structure can only be changed in the course base language.",
    );
    expect(tooltipCopies.some((element) => element.getAttribute("role") !== "tooltip")).toBe(true);
  });

  it("opens invalid sections and marks fields instead of turning labels red", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <TooltipProvider>
        <AiJudgeConfigurationDialog
          open
          onOpenChange={vi.fn()}
          value={{
            taskGoal: "Handle the conversation",
            passingThresholdPercent: 70,
            criteria: [
              {
                title: "",
                expectedBehavior: "",
                maxScore: 2,
                scoreGuidance: [],
              },
            ],
            blockingErrors: [{ description: "" }],
          }}
          onSaveBaseConfiguration={vi.fn()}
          onSaveTranslation={vi.fn()}
          language="en"
          baseLanguage="en"
          isPersisted
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Save configuration" }));

    const criterionTrigger = screen.getByRole("button", { name: /Untitled criterion/ });
    await waitFor(() => expect(criterionTrigger).toHaveAttribute("data-state", "open"));
    expect(screen.getByLabelText("Criterion title")).toHaveClass("border-error-500");
    expect(screen.getByText("Criterion title")).toHaveClass("text-neutral-900");
    expect(screen.getByText("Criterion title is required")).toBeVisible();
    expect(screen.getByText("Blocking errors").closest("details")).toHaveAttribute("open");
  });
});
