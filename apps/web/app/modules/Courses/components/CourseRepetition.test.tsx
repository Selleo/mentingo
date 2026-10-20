import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseRepetition } from "./CourseRepetition";

import type { GetCourseResponse } from "~/api/generated-api";

const { repeatCourse, navigateToNextLesson } = vi.hoisted(() => ({
  repeatCourse: vi.fn(),
  navigateToNextLesson: vi.fn(),
}));
vi.mock("~/api/mutations/useRepeatCourse", () => ({
  useRepeatCourse: () => ({ mutateAsync: repeatCourse, isPending: false }),
}));
vi.mock("../utils/navigateToNextLesson", () => ({ navigateToNextLesson }));
vi.mock("@remix-run/react", () => ({ useNavigate: () => vi.fn() }));

const current = {
  id: "current-state",
  completedAt: "2026-01-01T12:00:00.000Z",
  finishedChapterCount: 2,
};
const course = {
  id: "course",
  enrolled: true,
  courseChapterCount: 2,
  learningState: { enabled: true, current, repetition: null },
} as GetCourseResponse["data"];

describe("CourseRepetition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repeatCourse.mockResolvedValue({});
  });

  it("starts repetition explicitly and navigates only after the server succeeds", async () => {
    renderWith().render(<CourseRepetition course={course} />);
    fireEvent.click(screen.getByTestId("course-repeat-button"));
    await waitFor(() => expect(repeatCourse).toHaveBeenCalledWith(current.id));
    await waitFor(() =>
      expect(navigateToNextLesson).toHaveBeenCalledWith(course, expect.any(Function), {
        openFirstLesson: true,
      }),
    );
  });

  it.each([true, false])(
    "renders no duplicate summary during repetition with opt-in %s",
    (enabled) => {
      const repeating = {
        ...course,
        learningState: {
          enabled,
          current,
          repetition: { id: "repeat-state", completedAt: null, finishedChapterCount: 1 },
        },
      };
      const { container } = renderWith().render(<CourseRepetition course={repeating} />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("does not offer another repetition when opt-in is disabled", () => {
    renderWith().render(
      <CourseRepetition
        course={{ ...course, learningState: { ...course.learningState!, enabled: false } }}
      />,
    );
    expect(screen.queryByTestId("course-repeat-button")).not.toBeInTheDocument();
  });

  it("keeps the user in place when repetition fails", async () => {
    repeatCourse.mockRejectedValue(new Error("Start failed"));
    renderWith().render(<CourseRepetition course={course} />);
    fireEvent.click(screen.getByTestId("course-repeat-button"));
    await waitFor(() => expect(repeatCourse).toHaveBeenCalled());
    expect(navigateToNextLesson).not.toHaveBeenCalled();
  });
});
