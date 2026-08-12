import { createRemixStub } from "@remix-run/testing";
import { LESSON_TYPES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import LessonItem from "./LessonItem";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseLesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number] & {
  hasAccess: boolean;
};

const { accessState, authState } = vi.hoisted(() => ({
  accessState: {
    enrolled: true,
    isCourseStudentModeActive: false,
    isPreviewMode: false,
  },
  authState: {
    currentUser: { id: "user-1" } as { id: string } | undefined,
  },
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: authState.currentUser }),
}));

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: { enrolled: accessState.enrolled },
    isCourseStudentModeActive: accessState.isCourseStudentModeActive,
    isPreviewMode: accessState.isPreviewMode,
  }),
}));

const createLesson = (overrides: Partial<CourseLesson> = {}): CourseLesson =>
  ({
    id: "lesson-1",
    title: "Lesson one",
    status: "not_started",
    type: LESSON_TYPES.CONTENT,
    displayOrder: 1,
    quizQuestionCount: null,
    hasAccess: true,
    ...overrides,
  }) as CourseLesson;

const renderLesson = ({
  isFreemiumChapter = false,
  lesson = createLesson(),
}: {
  isFreemiumChapter?: boolean;
  lesson?: CourseLesson;
} = {}) => {
  const RemixStub = createRemixStub([
    {
      path: "*",
      Component: () => (
        <LessonItem
          courseSlug="course-one"
          isAdminExperience={false}
          isCompleted={false}
          isCurrent={false}
          isLast
          isFreemiumChapter={isFreemiumChapter}
          lesson={lesson}
        />
      ),
    },
  ]);

  return renderWith().render(<RemixStub />);
};

const expectLessonToBeBlocked = () => {
  expect(screen.queryByRole("link", { name: /Lesson one/ })).not.toBeInTheDocument();
  expect(screen.getByText("Lesson one").closest('[aria-disabled="true"]')).toBeInTheDocument();
};

describe("LessonItem", () => {
  beforeEach(() => {
    authState.currentUser = { id: "user-1" };
    accessState.enrolled = true;
    accessState.isCourseStudentModeActive = false;
    accessState.isPreviewMode = false;
  });

  it("links an accessible lesson for an enrolled learner", () => {
    renderLesson();

    expect(screen.getByRole("link", { name: /Lesson one/ })).toHaveAttribute(
      "href",
      "/course/course-one/lesson/lesson-1",
    );
  });

  it("keeps a sequence-blocked lesson visible without rendering a link", () => {
    renderLesson({ lesson: createLesson({ hasAccess: false }) });

    expectLessonToBeBlocked();
  });

  it("blocks a signed-in user who is not enrolled", () => {
    accessState.enrolled = false;

    renderLesson();

    expectLessonToBeBlocked();
  });

  it("allows a public visitor to open content in a freemium chapter", () => {
    authState.currentUser = undefined;
    accessState.enrolled = false;

    renderLesson({ isFreemiumChapter: true });

    expect(screen.getByRole("link", { name: /Lesson one/ })).toBeInTheDocument();
  });

  it("does not expose a freemium quiz to a public visitor", () => {
    authState.currentUser = undefined;
    accessState.enrolled = false;

    renderLesson({
      isFreemiumChapter: true,
      lesson: createLesson({ type: LESSON_TYPES.QUIZ }),
    });

    expectLessonToBeBlocked();
  });

  it("allows an authorized course editor to open lessons in Learning Mode", () => {
    accessState.enrolled = false;
    accessState.isCourseStudentModeActive = true;

    renderLesson();

    expect(screen.getByRole("link", { name: /Lesson one/ })).toBeInTheDocument();
  });

  it("allows a signed-in course editor to open lessons in preview mode", () => {
    accessState.enrolled = false;
    accessState.isPreviewMode = true;

    renderLesson();

    expect(screen.getByRole("link", { name: /Lesson one/ })).toBeInTheDocument();
  });
});
