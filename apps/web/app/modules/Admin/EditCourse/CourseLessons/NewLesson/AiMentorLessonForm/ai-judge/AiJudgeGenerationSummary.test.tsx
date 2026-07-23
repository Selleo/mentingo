import { AI_JUDGE_DRAFT_CHANGE_FIELD, AI_JUDGE_DRAFT_CHANGE_TYPE } from "@repo/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AI_JUDGE_GENERATION_CHECK_STATUS } from "./aiJudgeConfiguration.types";
import {
  AiJudgeGenerationChangeList,
  AiJudgeGenerationDraftSummary,
  AiJudgeGenerationFindingList,
} from "./AiJudgeGenerationSummary";

describe("AiJudgeGenerationSummary", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("shows the complete blocking rule in a clear referenced header", () => {
    const targetLabel = "Fails learners who do not make a real monitoring sales attempt";

    const { container } = renderWith().render(
      <AiJudgeGenerationFindingList
        checks={[
          {
            id: "overlap",
            label: "Ordinary scoring and automatic failure overlap for the same evidence.",
            detail: "Reserve automatic failure for independently disqualifying behavior.",
            targetRef: "B2",
            targetTypeLabel: "Blocking error",
            targetLabel,
            status: AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
          },
        ]}
      />,
    );

    expect(screen.getByText("Blocking error")).toBeVisible();
    expect(screen.getByText("Blocking error")).toHaveClass("text-sm");
    expect(screen.getByText("B2")).toBeVisible();
    expect(screen.getByText(targetLabel)).toBeVisible();
    expect(
      screen.queryByText("Ordinary scoring and automatic failure overlap for the same evidence."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Reserve automatic failure for independently disqualifying behavior."),
    ).toBeVisible();
    expect(container.querySelector("details")).not.toBeInTheDocument();
  });

  it("identifies the exact score-guidance field and score in the header", () => {
    renderWith().render(
      <AiJudgeGenerationFindingList
        checks={[
          {
            id: "example-mismatch",
            label: "The example demonstrates a stronger response than this score level.",
            targetRef: "C1",
            targetScore: 2,
            targetTypeLabel: "Accepted example",
            targetLabel: "Discovers the client's needs",
            status: AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
          },
        ]}
      />,
    );

    expect(screen.getByText("Accepted example")).toBeVisible();
    expect(screen.getByText("2 pts")).toBeVisible();
    expect(screen.getByText("C1")).toBeVisible();
    expect(screen.getByText("Discovers the client's needs")).toBeVisible();
    expect(screen.getByText("Accepted example").closest("header")).toHaveTextContent(
      "Accepted example2 pts-Discovers the client's needsC1",
    );
  });

  it("groups a blocking-error description change without repeating it as a heading", () => {
    const targetLabel = "Fails learners who do not make a real monitoring sales attempt";
    const { container } = renderWith().render(
      <AiJudgeGenerationChangeList
        showTitle={false}
        changes={[
          {
            type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
            targetRef: "B2",
            targetTypeLabel: "Blocking error",
            targetLabel,
            field: AI_JUDGE_DRAFT_CHANGE_FIELD.DESCRIPTION,
            before: "Fails learners who never mention monitoring",
            after: targetLabel,
          },
        ]}
      />,
    );

    expect(screen.getByText("Blocking error")).toBeVisible();
    expect(screen.getByText("B2")).toBeVisible();
    expect(container.querySelector("h4")).not.toBeInTheDocument();
    const insertedText = Array.from(container.querySelectorAll("ins"))
      .map(({ textContent }) => textContent)
      .join("");
    expect(insertedText).toContain("real sales attempt");
  });

  it("separates a score-guidance field label from its score badge", () => {
    renderWith().render(
      <AiJudgeGenerationChangeList
        showTitle={false}
        changes={[
          {
            type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
            targetRef: "C1",
            targetTypeLabel: "Score guidance",
            targetLabel: "Asks specific discovery questions",
            score: 2,
            field: AI_JUDGE_DRAFT_CHANGE_FIELD.EXAMPLE,
            before: "What is happening today?",
            after: "What happens today, and what impact does that have?",
          },
        ]}
      />,
    );

    expect(screen.getByText("Accepted example")).toBeVisible();
    expect(screen.getByText("2 pts")).toHaveClass("rounded-full");
    expect(screen.getByText("Score guidance").closest("header")).toHaveTextContent(
      "Score guidance-Asks specific discovery questionsC1",
    );
  });

  it("shows an added criterion title once without an empty before marker", () => {
    const title = "Maintains professional sales tone";
    const { container } = renderWith().render(
      <AiJudgeGenerationChangeList
        showTitle={false}
        changes={[
          {
            type: AI_JUDGE_DRAFT_CHANGE_TYPE.ADDED,
            targetRef: "C5",
            targetTypeLabel: "Criterion",
            targetLabel: title,
            field: AI_JUDGE_DRAFT_CHANGE_FIELD.TITLE,
            after: title,
          },
        ]}
      />,
    );

    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(screen.getByText("Criterion title")).toBeVisible();
    expect(container.querySelector("ins")).toHaveTextContent(title);
    expect(container.querySelector("del")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("→");
    expect(container).not.toHaveTextContent("—");
  });

  it("renders formatted task goals as readable plain text in the creation summary", () => {
    const { container } = renderWith().render(
      <AiJudgeGenerationDraftSummary
        draft={{
          taskGoal: "<ul><li><strong>Discover needs</strong></li><li>Propose a next step</li></ul>",
          passingThresholdPercent: 70,
          criteria: [],
          blockingErrors: [],
        }}
      />,
    );

    expect(screen.getByText("Discover needs Propose a next step")).toBeVisible();
    expect(container.querySelector("ul")).not.toBeInTheDocument();
    expect(container.querySelector("strong")).not.toBeInTheDocument();
  });
});
