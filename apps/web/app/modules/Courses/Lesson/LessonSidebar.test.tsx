import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { makeChapter, makeCourse, makeLesson } from "./courseTestFactories";
import { LessonSidebar } from "./LessonSidebar";

import type { Course } from "./courseTestFactories";

const courseAccessState = { isCourseStudentModeActive: false, isPreviewMode: false };

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => courseAccessState,
}));

vi.mock("~/hooks/useLessonsSequence", () => ({
  useLessonsSequence: () => ({ sequenceEnabled: false, isLoading: false }),
}));

const renderSidebar = (course: Course, lessonId: string) =>
  renderWith().render(
    <MemoryRouter>
      <LessonSidebar course={course} lessonId={lessonId} />
    </MemoryRouter>,
  );

describe("LessonSidebar", () => {
  it("exposes each lesson status as text and marks the current lesson with aria-current", () => {
    const course = makeCourse({
      chapters: [
        makeChapter({
          lessons: [
            makeLesson({ id: "lesson-1", title: "Intro", status: "completed" }),
            makeLesson({ id: "lesson-2", title: "Practice", status: "in_progress" }),
            makeLesson({ id: "lesson-3", title: "Wrap up", status: "not_started" }),
            makeLesson({ id: "lesson-4", title: "Final quiz", type: "quiz", status: "failed" }),
          ],
        }),
      ],
    });

    renderSidebar(course, "lesson-2");

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    const currentLesson = screen.getByRole("link", { current: "page" });

    expect(within(currentLesson).getByText("Practice")).toBeInTheDocument();
  });
});
