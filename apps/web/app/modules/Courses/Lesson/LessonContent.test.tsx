import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LessonContent } from "./LessonContent";
import { makeCourse, makeLesson } from "./testFactories";

import type { GetCourseResponse, GetLessonByIdResponse } from "~/api/generated-api";

vi.mock("~/api/mutations", () => ({
  useMarkLessonAsCompleted: () => ({ mutate: vi.fn() }),
}));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: { id: "admin-1" } }) }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ isPreviewMode: true, isEffectiveStudentExperience: false }),
}));
vi.mock("~/hooks/useLessonsSequence", () => ({
  useLessonsSequence: () => ({ sequenceEnabled: false }),
}));
vi.mock("./LessonContentRenderer", () => ({
  LessonContentRenderer: () => <p>Learner results</p>,
}));
vi.mock("./LessonVideoProgressStrip", () => ({ LessonVideoProgressStrip: () => null }));
vi.mock("./RequiredVideoLeaveGuard", () => ({ RequiredVideoLeaveGuard: () => null }));
vi.mock("~/components/VideoPlayer/Video", () => ({
  pauseAllLessonVideos: vi.fn(),
  resumeLessonVideo: vi.fn(),
}));
vi.mock("./CoursePreviewNotice", () => ({
  CoursePreviewNotice: () => <aside>Enroll or enable learning mode</aside>,
}));

describe("lesson content in statistics", () => {
  it.each(["ai_mentor", "quiz"] as const)(
    "shows %s results without the preview enrollment banner",
    (type) => {
      renderWith({ withQuery: true }).render(
        <LessonContent
          lesson={
            { id: "lesson-1", title: "Lesson results", type } as GetLessonByIdResponse["data"]
          }
          course={
            {
              id: "course-1",
              chapters: [{ lessons: [{ id: "lesson-1" }] }],
            } as GetCourseResponse["data"]
          }
          hideControls
          handlePrevious={vi.fn()}
          handleNext={vi.fn()}
          isFirstLesson
          isLastLesson
          lessonLoading={false}
        />,
      );
      expect(screen.getByText("Learner results")).toBeInTheDocument();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(screen.queryByText("Enroll or enable learning mode")).not.toBeInTheDocument();
    },
  );
});

describe("lesson navigation controls", () => {
  it("gives the previous and next lesson arrows accessible names", () => {
    renderWith({ withQuery: true }).render(
      <LessonContent
        lesson={makeLesson()}
        course={makeCourse()}
        handlePrevious={vi.fn()}
        handleNext={vi.fn()}
        isFirstLesson={false}
        isLastLesson={false}
        lessonLoading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous lesson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next lesson" })).toBeInTheDocument();
  });

  it("moves to the previous and next lesson when the arrows are clicked", async () => {
    const user = userEvent.setup();
    const handlePrevious = vi.fn();
    const handleNext = vi.fn();

    renderWith({ withQuery: true }).render(
      <LessonContent
        lesson={makeLesson()}
        course={makeCourse()}
        handlePrevious={handlePrevious}
        handleNext={handleNext}
        isFirstLesson={false}
        isLastLesson={false}
        lessonLoading={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous lesson" }));
    expect(handlePrevious).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next lesson" }));
    expect(handleNext).toHaveBeenCalledTimes(1);
  });

  it("disables the previous lesson arrow on the first lesson", () => {
    renderWith({ withQuery: true }).render(
      <LessonContent
        lesson={makeLesson()}
        course={makeCourse()}
        handlePrevious={vi.fn()}
        handleNext={vi.fn()}
        isFirstLesson
        isLastLesson={false}
        lessonLoading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous lesson" })).toBeDisabled();
  });

  it("shows the arrow name in a tooltip on keyboard focus", async () => {
    const user = userEvent.setup();

    renderWith({ withQuery: true }).render(
      <LessonContent
        lesson={makeLesson()}
        course={makeCourse()}
        handlePrevious={vi.fn()}
        handleNext={vi.fn()}
        isFirstLesson
        isLastLesson={false}
        lessonLoading={false}
      />,
    );

    await user.tab();

    expect(screen.getByRole("button", { name: "Next lesson" })).toHaveFocus();
    expect(await screen.findByRole("tooltip", { name: "Next lesson" })).toBeInTheDocument();
  });
});

describe("lesson heading", () => {
  const renderLessonContent = (focusTitleOnMount?: boolean) =>
    renderWith({ withQuery: true }).render(
      <LessonContent
        lesson={makeLesson({ title: "Lesson heading" })}
        course={makeCourse()}
        focusTitleOnMount={focusTitleOnMount}
        handlePrevious={vi.fn()}
        handleNext={vi.fn()}
        isFirstLesson={false}
        isLastLesson={false}
        lessonLoading={false}
      />,
    );

  it("renders the lesson title as the level-one heading without stealing focus on first load", () => {
    renderLessonContent();

    expect(screen.getByRole("heading", { level: 1, name: "Lesson heading" })).not.toHaveFocus();
  });

  it("moves focus to the lesson heading after navigating to another lesson", () => {
    renderLessonContent(true);

    expect(screen.getByRole("heading", { level: 1, name: "Lesson heading" })).toHaveFocus();
  });
});
