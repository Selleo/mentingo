import { expect } from "@playwright/test";

import type { FixtureApiClient } from "../../utils/api-client";

type LessonStatusExpectation = {
  completedLessonCount?: number;
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
          completedLessonCount: chapter?.completedLessonCount,
          lessonStatus: lesson?.status,
        };
      },
      { timeout: 15_000 },
    )
    .toMatchObject({
      ...(expectation.completedLessonCount === undefined
        ? {}
        : { completedLessonCount: expectation.completedLessonCount }),
      lessonStatus: expectation.lessonStatus,
    });
};

type QuizProgressExpectation = {
  attempts?: number;
  completedLessonCount?: number;
  correctAnswerCount?: number;
  courseLessonStatus?: string;
  isQuizAwaitingReview?: boolean;
  isQuizFeedbackRedacted?: boolean;
  lessonCompleted?: boolean;
  score?: number | null;
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

        // Raw values: a field the API leaves out must fail the match, not default to the expectation.
        return {
          completedLessonCount: chapter?.completedLessonCount,
          courseLessonStatus: lesson?.status,
          lessonCompleted: lessonData.lessonCompleted,
          attempts: lessonData.attempts,
          correctAnswerCount: lessonData.quizDetails?.correctAnswerCount,
          isQuizAwaitingReview: lessonData.isQuizAwaitingReview,
          isQuizFeedbackRedacted: lessonData.isQuizFeedbackRedacted,
          score: lessonData.quizDetails?.score,
        };
      },
      { timeout: 15_000 },
    )
    .toMatchObject(input.expected);
};

/** The course as the signed-in learner sees it, including chapter progress and learning state. */
export const getLearnerCourseFlow = async (apiClient: FixtureApiClient, courseId: string) => {
  const response = await apiClient.api.courseControllerGetCourse({ id: courseId, language: "en" });

  return response.data.data;
};
