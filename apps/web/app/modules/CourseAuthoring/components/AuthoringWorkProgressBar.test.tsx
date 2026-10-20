import "~/utils/mocks/i18next.mock";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthoringWorkProgressBar } from "./AuthoringWorkProgressBar";

import type { AuthoringTask } from "../courseAuthoring.types";

const task = (overrides: Partial<AuthoringTask> = {}): AuthoringTask => ({
  taskId: "task-1",
  requestId: "request-1",
  status: "running",
  errorCode: null,
  outputId: null,
  ...overrides,
});

describe("authoring progress", () => {
  it("shows indeterminate progress when tasks may still expand", () => {
    render(
      <AuthoringWorkProgressBar tasks={[task(), task({ taskId: "failed", status: "failed" })]} />,
    );
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("uses server lesson counts, including a newer sibling update", () => {
    render(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            workProgress: { stage: "lesson_generation", totalLessons: 8, completedLessons: 1 },
          }),
          task({
            taskId: "task-2",
            workProgress: { stage: "lesson_generation", totalLessons: 8, completedLessons: 3 },
          }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "37.5");
  });
  it("does not combine progress from separate requests", () => {
    render(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            workProgress: { stage: "lesson_generation", totalLessons: 8, completedLessons: 8 },
            status: "succeeded",
          }),
          task({ taskId: "task-2", requestId: "request-2" }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("drops finished planning counts when lesson writing is queued", () => {
    render(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "detailed_plan",
            status: "succeeded",
            workProgress: { stage: "lesson_planning", totalLessons: 10, completedLessons: 10 },
          }),
          task({ taskId: "lesson-1", kind: "lesson", status: "queued" }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("shows the current planning chapter count as its own stage", () => {
    render(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "detailed_plan",
            workProgress: {
              stage: "lesson_planning",
              chapters: [
                { chapterId: "a", title: "One", lessonCount: 5, status: "complete" },
                { chapterId: "b", title: "Two", lessonCount: 5, status: "running" },
              ],
            },
          }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(/1.*2/);
  });
  it("does not invent a completed bar for failed work", () => {
    render(<AuthoringWorkProgressBar tasks={[task({ status: "failed" })]} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
