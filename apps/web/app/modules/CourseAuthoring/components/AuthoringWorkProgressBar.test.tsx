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
  it("advances only at real outline milestones and shows streamed draft counts and repair passes", () => {
    const outlineProgress = {
      stage: "outline" as const,
      outlinePhase: "drafting" as const,
      outlineIteration: 1,
      draftedChapters: 0,
      draftedLessons: 0,
      completedSteps: 0,
      totalSteps: 3,
    };
    const { rerender } = render(
      <AuthoringWorkProgressBar tasks={[task({ kind: "plan", workProgress: outlineProgress })]} />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "plan",
            workProgress: {
              ...outlineProgress,
              draftedChapters: 6,
              draftedLessons: 18,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(/Chapters in draft: 6/);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "plan",
            workProgress: {
              ...outlineProgress,
              outlinePhase: "reviewing",
              completedSteps: 1,
            },
          }),
        ]}
      />,
    );
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(
      100 / 3,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(/Checking outline/);
    rerender(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "plan",
            workProgress: {
              ...outlineProgress,
              outlinePhase: "repairing",
              outlineIteration: 2,
              completedSteps: 1,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(/Refining outline.*Pass 2/);
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(
      100 / 3,
    );
    rerender(
      <AuthoringWorkProgressBar
        tasks={[
          task({
            kind: "plan",
            workProgress: {
              ...outlineProgress,
              outlinePhase: "finalizing",
              completedSteps: 2,
            },
          }),
        ]}
      />,
    );
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(
      200 / 3,
    );
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(/Preparing outline for review/);
  });

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
