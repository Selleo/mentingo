import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AiMentorPracticeHeader } from "./AiMentorPracticeHeader";

describe("AiMentorPracticeHeader", () => {
  it("opens the task description when entering a practice session", () => {
    renderWith().render(
      <AiMentorPracticeHeader
        title="Practice a difficult customer conversation"
        taskGoal="Practice acknowledging the customer's concern and agreeing on a next step."
      />,
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Opis zadania" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Practice acknowledging the customer's concern and agreeing on a next step.",
      ),
    ).toBeVisible();
  });
});
