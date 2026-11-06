import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSE_STATISTICS_HANDLES } from "../../../../../../e2e/data/statistics/handles";

import LessonPreviewDialog from "./LessonPreviewDialog";

import type { GetCourseResponse } from "~/api/generated-api";

const state = vi.hoisted(() => ({ description: null as string | null }));
vi.mock("~/api/queries", () => ({
  useLesson: () => ({
    data: {
      id: "lesson-1",
      title: "HTML Basics",
      type: "ai_mentor",
      description: state.description,
    },
    isLoading: false,
  }),
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("~/modules/Courses/Lesson/LessonContent", () => ({
  LessonContent: () => <p>Recorded conversation</p>,
}));
vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock("~/components/UserProfile/UserAvatar", () => ({ UserAvatar: () => null }));

const renderDialog = () =>
  renderWith().render(
    <LessonPreviewDialog
      course={
        {
          chapters: [{ title: "Chapter", displayOrder: 1, lessons: [{ id: "lesson-1" }] }],
        } as GetCourseResponse["data"]
      }
      lessonId="lesson-1"
      userId="student-1"
      studentName="Vance Admin"
      isOpen
    />,
  );

describe("statistics task description", () => {
  beforeEach(() => {
    state.description = null;
  });

  it("opens an explicit empty state instead of disabling the task button", async () => {
    renderDialog();
    const button = screen.getByTestId(
      COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_TASK_DESCRIPTION_BUTTON,
    );
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(
      screen.getByText("No task description has been added to this lesson."),
    ).toBeInTheDocument();
  });

  it("shows the saved task description", async () => {
    state.description = "Identify the opening tag, closing tag, and content.";
    renderDialog();
    await userEvent.click(
      screen.getByTestId(COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_TASK_DESCRIPTION_BUTTON),
    );
    expect(screen.getByText(state.description)).toBeInTheDocument();
  });
});
