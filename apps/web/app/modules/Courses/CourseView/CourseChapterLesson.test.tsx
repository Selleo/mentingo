import { LESSON_TYPES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseChapterLesson } from "./CourseChapterLesson";

import type { Lesson } from "./CourseChapter";

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    isCourseStudentModeActive: false,
    isPreviewMode: false,
  }),
}));

const createLesson = (overrides: Partial<Lesson> = {}): Lesson =>
  ({
    id: "lesson-1",
    title: "Getting started",
    status: "not_started",
    type: LESSON_TYPES.CONTENT,
    quizQuestionCount: null,
    hasAccess: true,
    ...overrides,
  }) as Lesson;

describe("CourseChapterLesson", () => {
  it("shows only the title in the row and reveals the localized type when hovering the icon", async () => {
    const user = userEvent.setup();
    renderWith().render(<CourseChapterLesson lesson={createLesson()} />);

    expect(screen.getByTestId("lesson-title")).toHaveTextContent("Getting started");
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    await user.hover(screen.getByRole("img", { name: "Content" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Content");
  });

  it("keeps quiz question counts and labels a blocked lesson icon", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <CourseChapterLesson
        lesson={createLesson({
          hasAccess: false,
          type: LESSON_TYPES.QUIZ,
          quizQuestionCount: 3,
        })}
      />,
    );

    expect(screen.getByTestId("lesson-title")).toHaveTextContent("Getting started (3)");
    expect(screen.queryByText("Quiz")).not.toBeInTheDocument();
    await user.hover(screen.getByRole("img", { name: "Quiz" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Quiz");
  });
});
