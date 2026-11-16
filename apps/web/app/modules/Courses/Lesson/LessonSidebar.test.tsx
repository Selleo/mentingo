import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LessonSidebar } from "./LessonSidebar";

import type { GetCourseResponse } from "~/api/generated-api";

const courseAccessState = { isCourseStudentModeActive: false, isPreviewMode: false };

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => courseAccessState,
}));

vi.mock("~/hooks/useLessonsSequence", () => ({
  useLessonsSequence: () => ({ sequenceEnabled: false, isLoading: false }),
}));

type Course = GetCourseResponse["data"];
type Chapter = Course["chapters"][number];
type SidebarLesson = Chapter["lessons"][number];

// Test-only builders. The return-type annotations check defaults against the generated shape,
// so tests get fully-typed objects from overrides without casting.
const makeLesson = (overrides: Partial<SidebarLesson> = {}): SidebarLesson => ({
  id: "lesson-1",
  title: "Getting started",
  type: "content",
  displayOrder: 1,
  status: "not_started",
  quizQuestionCount: null,
  ...overrides,
});

const makeChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: "chapter-1",
  title: "Chapter one",
  lessonCount: 1,
  lessons: [makeLesson()],
  chapterProgress: "in_progress",
  displayOrder: 1,
  ...overrides,
});

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  category: "General",
  chapters: [makeChapter()],
  courseChapterCount: 1,
  currency: "pln",
  description: "Course description",
  id: "course-1",
  status: "published",
  originType: "regular",
  isContentReadonly: false,
  courseType: "default",
  priceInCents: 0,
  thumbnailPositionY: 0,
  title: "Course title",
  slug: "course-slug",
  stripeProductId: null,
  stripePriceId: null,
  availableLocales: ["en"],
  baseLanguage: "en",
  dueDate: null,
  ...overrides,
});

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
          ],
        }),
      ],
    });

    renderSidebar(course, "lesson-2");

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Not Started")).toBeInTheDocument();

    const currentLesson = screen.getByRole("link", { current: "page" });

    expect(within(currentLesson).getByText("Practice")).toBeInTheDocument();
  });
});
