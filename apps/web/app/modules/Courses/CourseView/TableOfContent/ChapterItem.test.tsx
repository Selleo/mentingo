import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import ChapterItem from "./ChapterItem";

import type { GetCourseResponse } from "~/api/generated-api";

type Chapter = GetCourseResponse["data"]["chapters"][number];
type ChapterWithLessonAccess = Omit<Chapter, "lessons"> & {
  lessons: Array<Chapter["lessons"][number] & { hasAccess: boolean }>;
};

const onToggle = vi.fn();

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" } }),
}));

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: { enrolled: true },
    isCourseStudentModeActive: false,
    isPreviewMode: false,
  }),
}));

const createChapter = (overrides: Partial<ChapterWithLessonAccess> = {}): ChapterWithLessonAccess =>
  ({
    id: "chapter-1",
    title: "Statistical Analysis",
    lessonCount: 3,
    chapterProgress: "in_progress",
    estimatedDurationSeconds: 4_800,
    lessons: [
      {
        id: "lesson-1",
        title: "Completed lesson",
        status: "completed",
        type: "content",
        displayOrder: 1,
        quizQuestionCount: null,
        hasAccess: true,
      },
      {
        id: "lesson-2",
        title: "Current lesson",
        status: "in_progress",
        type: "content",
        displayOrder: 2,
        quizQuestionCount: null,
        hasAccess: true,
      },
      {
        id: "lesson-3",
        title: "Next lesson",
        status: "not_started",
        type: "content",
        displayOrder: 3,
        quizQuestionCount: null,
        hasAccess: true,
      },
    ],
    ...overrides,
  }) as ChapterWithLessonAccess;

describe("ChapterItem", () => {
  it("shows active lesson progress for the current student chapter", () => {
    const { container } = renderWith().render(
      <ChapterItem
        chapter={createChapter()}
        chapterNumber={4}
        courseSlug="statistics-course"
        isAdminExperience={false}
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("Statistical Analysis")).toBeInTheDocument();
    expect(screen.getByText("1 h 20 min")).toBeInTheDocument();
    expect(screen.getByText("3 lessons")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-primary-700")).toHaveLength(3);
    expect(container.querySelectorAll(".bg-primary-100")).toHaveLength(1);
  });

  it("does not show lesson progress in admin experience", () => {
    renderWith().render(
      <ChapterItem
        chapter={createChapter()}
        chapterNumber={4}
        courseSlug="statistics-course"
        isAdminExperience
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.queryByText("2/3")).not.toBeInTheDocument();
  });

  it("links expanded lessons to their course lesson routes", () => {
    const RemixStub = createRemixStub([
      {
        path: "*",
        Component: () => (
          <ChapterItem
            chapter={createChapter()}
            chapterNumber={4}
            courseSlug="statistics-course"
            isAdminExperience={false}
            isExpanded
            onToggle={onToggle}
          />
        ),
      },
    ]);

    renderWith().render(<RemixStub />);

    expect(screen.getByRole("link", { name: /Completed lesson/ })).toHaveAttribute(
      "href",
      "/course/statistics-course/lesson/lesson-1",
    );
  });
});
