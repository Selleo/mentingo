import { AxiosError } from "axios";

import { queryClient } from "~/api/queryClient";

import type { ApiErrorResponse } from "~/api/types";

const CLOSED_QUIZ_ATTEMPT_ERRORS = [
  "studentLessonView.validation.quizAttemptExpired",
  "studentLessonView.validation.quizAttemptNotStarted",
];

export const isClosedQuizAttemptError = (error: unknown) =>
  error instanceof AxiosError &&
  CLOSED_QUIZ_ATTEMPT_ERRORS.includes(
    (error.response?.data as ApiErrorResponse | undefined)?.message ?? "",
  );

// The server already finalized (or never opened) the timed attempt, so the lesson view is stale.
export const refetchLessonOnClosedQuizAttempt = async (error: unknown, lessonId: string) => {
  if (!isClosedQuizAttemptError(error)) return;

  await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
};
