import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AiMentorEvaluationDialog } from "./AiMentorEvaluationDialog";
import { AI_MENTOR_EVALUATION_CONTEXT } from "./AiMentorEvaluationDialog.types";

describe("AiMentorEvaluationDialog", () => {
  it("shows criterion scores and blocking-error evidence without an overall summary", () => {
    renderWith().render(
      <AiMentorEvaluationDialog
        open
        onOpenChange={vi.fn()}
        evaluation={{
          passed: false,
          minScore: 3,
          score: 4,
          maxScore: 5,
          percentage: 80,
          criteria: [
            {
              criterionId: null,
              title: "Discovers needs",
              awardedScore: 4,
              maxScore: 5,
              status: "partial",
              learnerSafeFeedback: "You asked two useful discovery questions.",
            },
          ],
          blockingErrors: [
            {
              blockingErrorId: null,
              description: "Makes unsupported guarantees",
              learnerSafeFeedback: "You guaranteed delivery by Friday without confirming it.",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Discovers needs")).toBeVisible();
    expect(screen.getByText("4/5 pts")).toBeVisible();
    expect(screen.getByText("You asked two useful discovery questions.")).toBeVisible();
    expect(screen.getByText("Makes unsupported guarantees")).toBeVisible();
    expect(
      screen.getByText("You guaranteed delivery by Friday without confirming it."),
    ).toBeVisible();
    expect(screen.queryByText("Overall feedback")).toBeNull();
  });

  it("explains when the assessment has no detailed feedback", () => {
    renderWith().render(
      <AiMentorEvaluationDialog
        open
        onOpenChange={vi.fn()}
        evaluation={{
          passed: true,
          minScore: 0,
          score: 0,
          maxScore: 0,
          percentage: 100,
          criteria: [],
          blockingErrors: [],
        }}
      />,
    );

    expect(screen.getByText("No detailed feedback available")).toBeVisible();
    expect(
      screen.getByText(
        "This assessment has no scored criteria, and no blocking errors were detected in your attempt.",
      ),
    ).toBeVisible();
  });

  it("uses the localized task assessment label for standalone practice feedback", () => {
    renderWith().render(
      <AiMentorEvaluationDialog
        context={AI_MENTOR_EVALUATION_CONTEXT.PRACTICE}
        open
        onOpenChange={vi.fn()}
        evaluation={{
          passed: true,
          minScore: 1,
          score: 1,
          maxScore: 1,
          percentage: 100,
          criteria: [
            {
              criterionId: null,
              title: "Acknowledges the customer",
              awardedScore: 1,
              maxScore: 1,
              status: "met",
              learnerSafeFeedback: "You acknowledged the customer's concern.",
            },
          ],
          blockingErrors: [],
        }}
      />,
    );

    expect(screen.getByText("Task assessment")).toBeVisible();
  });
});
