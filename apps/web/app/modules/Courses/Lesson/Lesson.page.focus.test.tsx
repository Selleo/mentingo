import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePageTitle } from "~/hooks/usePageTitle";

import LessonPage from "./Lesson.page";
import { makeCourse, makeLesson } from "./testFactories";

import type { GetLessonByIdResponse } from "~/api/generated-api";

type LessonContentMockProps = {
  lesson: GetLessonByIdResponse["data"];
  focusTitleOnMount?: boolean;
  onTitleFocused?: () => void;
};

const mounts: Array<{ lessonId: string; focusTitleOnMount: boolean }> = [];
const lessons: Record<string, GetLessonByIdResponse["data"]> = {
  "lesson-1": makeLesson({ id: "lesson-1", title: "Lesson One", learningStateId: "state-1" }),
  "lesson-2": makeLesson({ id: "lesson-2", title: "Lesson Two", learningStateId: "state-1" }),
};
const course = makeCourse({
  availableLocales: ["en"],
  chapters: [
    {
      ...makeCourse().chapters[0],
      lessons: [
        { ...makeCourse().chapters[0].lessons[0], id: "lesson-1" },
        { ...makeCourse().chapters[0].lessons[0], id: "lesson-2", displayOrder: 2 },
      ],
    },
  ],
});

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "student-1" } }),
  useLesson: (lessonId: string) => ({ data: lessons[lessonId], isFetching: false, isError: false }),
  useCourse: () => ({ data: course }),
  lessonQueryOptions: () => ({ queryKey: ["lesson"] }),
}));
vi.mock("~/api/queries/useCourse", () => ({
  courseQueryOptions: () => ({ queryKey: ["course"] }),
  getCourseQueryKey: () => ["course"],
}));
vi.mock("~/api/queryClient", () => ({
  queryClient: { fetchQuery: () => Promise.resolve(), invalidateQueries: vi.fn() },
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "en", setLanguage: vi.fn() }),
}));
vi.mock("~/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("~/hooks/useLearningTimeTracker", () => ({ useLearningTimeTracker: vi.fn() }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: ({ children }: { children: React.ReactNode }) => children,
  useCourseAccessProvider: () => ({ course, isEffectiveStudentExperience: true }),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/modules/Courses/Lesson/LearningModeBanner", () => ({ LearningModeBanner: () => null }));
vi.mock("~/modules/Courses/Lesson/LessonSidebar", () => ({ LessonSidebar: () => null }));
vi.mock("~/modules/Courses/Lesson/LessonContent", () => ({
  LessonContent: ({
    lesson,
    focusTitleOnMount = false,
    onTitleFocused,
  }: LessonContentMockProps) => {
    useEffect(() => {
      mounts.push({ lessonId: lesson.id, focusTitleOnMount });
      if (focusTitleOnMount) onTitleFocused?.();
      // Record each mount once; the real effect focuses only while focusTitleOnMount is true.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
  },
}));

const renderLesson = () => {
  const router = createMemoryRouter(
    [{ path: "/course/:courseId/lesson/:lessonId", element: <LessonPage /> }],
    { initialEntries: ["/course/course-1/lesson/lesson-1"] },
  );

  render(<RouterProvider router={router} />);

  return router;
};

describe("LessonPage heading focus", () => {
  beforeEach(() => {
    mounts.length = 0;
    lessons["lesson-2"] = makeLesson({
      id: "lesson-2",
      title: "Lesson Two",
      learningStateId: "state-1",
    });
  });

  it("focuses the heading only when moving to a different lesson", async () => {
    const router = renderLesson();

    await waitFor(() =>
      expect(mounts).toEqual([{ lessonId: "lesson-1", focusTitleOnMount: false }]),
    );

    await act(() => router.navigate("/course/course-1/lesson/lesson-2"));
    await waitFor(() =>
      expect(mounts.at(-1)).toEqual({ lessonId: "lesson-2", focusTitleOnMount: true }),
    );
    expect(vi.mocked(usePageTitle)).toHaveBeenLastCalledWith(["Lesson Two", "Course"]);

    await act(() => router.navigate("/course/course-1/lesson/lesson-1"));
    await waitFor(() =>
      expect(mounts.at(-1)).toEqual({ lessonId: "lesson-1", focusTitleOnMount: true }),
    );
  });

  it("does not move focus when the same lesson remounts after a quiz retake", async () => {
    const router = renderLesson();

    await waitFor(() => expect(mounts).toHaveLength(1));
    await act(() => router.navigate("/course/course-1/lesson/lesson-2"));
    await waitFor(() => expect(mounts).toHaveLength(2));

    lessons["lesson-2"] = makeLesson({
      id: "lesson-2",
      title: "Lesson Two",
      learningStateId: "state-2",
    });
    await act(() => router.navigate("/course/course-1/lesson/lesson-2"));

    await waitFor(() => expect(mounts).toHaveLength(3));
    expect(mounts[2]).toEqual({ lessonId: "lesson-2", focusTitleOnMount: false });
  });
});
