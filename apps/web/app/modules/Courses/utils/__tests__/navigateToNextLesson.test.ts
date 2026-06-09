import { describe, expect, it, vi } from "vitest";

import { navigateToNextLesson } from "../navigateToNextLesson";

import type { NavigateFunction } from "@remix-run/react";
import type { GetCourseResponse } from "~/api/generated-api";

describe("navigateToNextLesson", () => {
  it("navigates to the first accessible unfinished lesson with its chapter id", () => {
    const courseData = {
      slug: "course-slug",
      chapters: [
        {
          id: "chapter-1",
          lessons: [
            {
              id: "completed-lesson",
              status: "completed",
            },
            {
              id: "blocked-lesson",
              status: "blocked",
            },
          ],
        },
        {
          id: "chapter-2",
          lessons: [
            {
              id: "target-lesson",
              status: "in_progress",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const navigate = vi.fn() as unknown as NavigateFunction;

    navigateToNextLesson(courseData, navigate);

    expect(navigate).toHaveBeenCalledWith("/course/course-slug/lesson/target-lesson", {
      state: { chapterId: "chapter-2" },
    });
  });

  it("does not navigate when no accessible unfinished lesson exists", () => {
    const courseData = {
      slug: "course-slug",
      chapters: [
        {
          id: "chapter-1",
          lessons: [
            {
              id: "completed-lesson",
              status: "completed",
            },
            {
              id: "blocked-lesson",
              status: "blocked",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const navigate = vi.fn() as unknown as NavigateFunction;

    navigateToNextLesson(courseData, navigate);

    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates to the first lesson when the course is completed", () => {
    const courseData = {
      slug: "course-slug",
      chapters: [
        {
          id: "chapter-1",
          lessons: [
            {
              id: "first-lesson",
              status: "completed",
            },
            {
              id: "second-lesson",
              status: "completed",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const navigate = vi.fn() as unknown as NavigateFunction;

    navigateToNextLesson(courseData, navigate);

    expect(navigate).toHaveBeenCalledWith("/course/course-slug/lesson/first-lesson", {
      state: { chapterId: "chapter-1" },
    });
  });

  it("navigates to the first lesson when requested for preview mode", () => {
    const courseData = {
      slug: "course-slug",
      chapters: [
        {
          id: "chapter-1",
          lessons: [
            {
              id: "first-lesson",
              status: "completed",
            },
            {
              id: "second-lesson",
              status: "in_progress",
            },
          ],
        },
      ],
    } as GetCourseResponse["data"];
    const navigate = vi.fn() as unknown as NavigateFunction;

    navigateToNextLesson(courseData, navigate, { openFirstLesson: true });

    expect(navigate).toHaveBeenCalledWith("/course/course-slug/lesson/first-lesson", {
      state: { chapterId: "chapter-1" },
    });
  });
});
