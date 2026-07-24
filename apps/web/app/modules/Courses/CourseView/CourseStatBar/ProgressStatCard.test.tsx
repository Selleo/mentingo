import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import ProgressStatCard from "./ProgressStatCard";

describe("ProgressStatCard", () => {
  it("renders remaining time and chapter progress for learner experience", () => {
    renderWith().render(
      <ProgressStatCard
        completedChapterCount={1}
        courseChapterCount={3}
        isAdminExperience={false}
        onEnterLearningMode={vi.fn()}
        timeLeftSeconds={5_400}
      />,
    );

    expect(screen.getByText("Your progress")).toBeInTheDocument();
    expect(screen.getByText("1 h 30 min")).toBeInTheDocument();
    expect(screen.getByText("remaining")).toBeInTheDocument();
    expect(screen.getByText("1 / 3 chapters")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("shows a finished message instead of zero remaining time for a completed course", () => {
    renderWith().render(
      <ProgressStatCard
        completedChapterCount={3}
        courseChapterCount={3}
        isAdminExperience={false}
        onEnterLearningMode={vi.fn()}
        timeLeftSeconds={0}
      />,
    );

    expect(screen.getByText("Course finished")).toBeInTheDocument();
    expect(screen.queryByText("0 min")).not.toBeInTheDocument();
    expect(screen.queryByText("remaining")).not.toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("lets admins enter learning mode instead of showing learner progress details", async () => {
    const user = userEvent.setup();
    const onEnterLearningMode = vi.fn();

    renderWith().render(
      <ProgressStatCard
        completedChapterCount={1}
        courseChapterCount={3}
        isAdminExperience
        onEnterLearningMode={onEnterLearningMode}
        timeLeftSeconds={5_400}
      />,
    );

    expect(screen.queryByText("1 / 3 chapters")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enter learning mode" }));

    expect(onEnterLearningMode).toHaveBeenCalledOnce();
  });
});
