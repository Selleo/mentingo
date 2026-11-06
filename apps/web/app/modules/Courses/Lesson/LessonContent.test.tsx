import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LessonContent } from "./LessonContent";

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
