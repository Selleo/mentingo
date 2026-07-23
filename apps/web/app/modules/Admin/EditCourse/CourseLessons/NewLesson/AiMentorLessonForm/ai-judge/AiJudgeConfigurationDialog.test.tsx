import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AiJudgeConfigurationDialog } from "./AiJudgeConfigurationDialog";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeValidationResult,
} from "./aiJudgeConfiguration.types";
import type { FormEvent } from "react";

vi.mock("~/components/RichText/Editor", () => ({
  BoldBulletEditor: ({
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

describe("AiJudgeConfigurationDialog criterion accordion", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("uses the bounded mobile drawer shell and a full-width threshold control", () => {
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

    expect(screen.getByRole("dialog")).toHaveClass("h-[85dvh]");
    expect(screen.getByLabelText("Passing threshold").parentElement).toHaveClass(
      "w-full",
      "sm:w-24",
    );
  });

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

    fireEvent.change(screen.getByRole("textbox", { name: "Task goal" }), {
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

  it("shows independent quality findings in a dedicated result dialog", async () => {
    const user = userEvent.setup();
    const validation = {
      passed: false,
      summary: "The task goal needs a more observable outcome.",
      issues: [
        {
          code: "goal_not_measurable",
          severity: "error",
          target: { type: "configuration", field: "taskGoal" },
          message: "The goal is too broad.",
          correction: "Describe what the learner must demonstrate.",
        },
      ],
    };
    const onValidateConfiguration = vi.fn().mockResolvedValue(validation);
    const onImproveWithAi = vi.fn();
    const configuration = {
      taskGoal: "Handle the conversation",
      passingThresholdPercent: 70,
      criteria: [],
      blockingErrors: [],
    };

    renderWith().render(
      <TooltipProvider>
        <AiJudgeConfigurationDialog
          open
          onOpenChange={vi.fn()}
          value={configuration}
          onSaveBaseConfiguration={vi.fn()}
          onSaveTranslation={vi.fn()}
          onValidateConfiguration={onValidateConfiguration}
          onImproveWithAi={onImproveWithAi}
          language="en"
          baseLanguage="en"
          isPersisted={false}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "AI assistance" }));
    await user.click(screen.getByRole("menuitem", { name: "Check quality with AI" }));

    expect(await screen.findByText("The task goal needs a more observable outcome.")).toBeVisible();
    expect(screen.getByText("Describe what the learner must demonstrate.")).toBeVisible();

    expect(screen.getByRole("dialog", { name: "Quality check" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Improve with AI" }));

    expect(onImproveWithAi).toHaveBeenCalledWith(configuration, validation);
    expect(screen.queryByRole("dialog", { name: "Quality check" })).not.toBeInTheDocument();
  });

  it("opens quality progress in a dialog and cancels the active request", async () => {
    const user = userEvent.setup();
    let requestSignal: AbortSignal | undefined;
    const onValidateConfiguration = vi.fn(
      (_configuration: AiJudgeConfigurationDraft, signal?: AbortSignal) =>
        new Promise<AiJudgeValidationResult>((_, reject) => {
          requestSignal = signal;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    renderWith().render(
      <TooltipProvider>
        <AiJudgeConfigurationDialog
          open
          onOpenChange={vi.fn()}
          value={{
            taskGoal: "Handle the conversation",
            passingThresholdPercent: 70,
            criteria: [],
            blockingErrors: [],
          }}
          onSaveBaseConfiguration={vi.fn()}
          onSaveTranslation={vi.fn()}
          onValidateConfiguration={onValidateConfiguration}
          language="en"
          baseLanguage="en"
          isPersisted={false}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "AI assistance" }));
    await user.click(screen.getByRole("menuitem", { name: "Check quality with AI" }));

    const qualityDialog = screen.getByRole("dialog", { name: "Quality check" });
    expect(within(qualityDialog).getByText("Checking quality...")).toBeVisible();

    await user.click(within(qualityDialog).getByRole("button", { name: "Cancel" }));

    expect(requestSignal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByText("Checking quality...")).not.toBeInTheDocument());
  });
});
