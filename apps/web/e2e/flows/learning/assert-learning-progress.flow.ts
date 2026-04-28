import { expect } from "@playwright/test";

import type { FixtureApiClient } from "../../utils/api-client";

type LessonStatusExpectation = {
  completedLessonCount: number;
  lessonId: string;
  lessonStatus: string;
};

export const assertCourseLessonProgressFlow = async (
  apiClient: FixtureApiClient,
  courseId: string,
  expectation: LessonStatusExpectation,
) => {
  await expect
    .poll(
      async () => {
        const response = await apiClient.api.courseControllerGetCourse({
          id: courseId,
          language: "en",
        });
        const chapter = response.data.data.chapters[0];
        const lesson = chapter?.lessons.find((item) => item.id === expectation.lessonId);

        return {
          completedLessonCount: chapter?.completedLessonCount ?? 0,
          lessonStatus: lesson?.status,
        };
      },
      { timeout: 15_000 },
    )
    .toEqual({
      completedLessonCount: expectation.completedLessonCount,
      lessonStatus: expectation.lessonStatus,
    });
};

type QuizProgressExpectation = {
  attempts: number;
  completedLessonCount: number;
  courseLessonStatus: string;
  lessonCompleted: boolean;
};

export const assertQuizLessonProgressFlow = async (
  apiClient: FixtureApiClient,
  input: {
    courseId: string;
    lessonId: string;
    studentId: string;
    expected: QuizProgressExpectation;
  },
) => {
  await expect
    .poll(
      async () => {
        const [courseResponse, lessonResponse] = await Promise.all([
          apiClient.api.courseControllerGetCourse({
            id: input.courseId,
            language: "en",
          }),
          apiClient.api.lessonControllerGetLessonById(input.lessonId, {
            language: "en",
            studentId: input.studentId,
          }),
        ]);

        const chapter = courseResponse.data.data.chapters[0];
        const lesson = chapter?.lessons.find((item) => item.id === input.lessonId);
        const lessonData = lessonResponse.data.data;

        return {
          completedLessonCount: chapter?.completedLessonCount ?? 0,
          courseLessonStatus: lesson?.status,
          lessonCompleted: lessonData.lessonCompleted ?? false,
          attempts: lessonData.attempts ?? 0,
        };
      },
      { timeout: 15_000 },
    )
    .toEqual(input.expected);
};
