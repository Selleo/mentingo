import { QUIZ_GRADING_HANDLES } from "../../data/quiz-grading/handles";

import type { Page } from "@playwright/test";

export const gradeQuizAnswerFlow = async (
  page: Page,
  { comment, verdict }: { comment: string; verdict: "passed" | "failed" },
) => {
  await page.getByTestId(QUIZ_GRADING_HANDLES.VERDICT_OPTION(verdict)).click();
  await page.getByTestId(QUIZ_GRADING_HANDLES.COMMENT_INPUT).fill(comment);
  await page.getByTestId(QUIZ_GRADING_HANDLES.SUBMIT_BUTTON).click();
};
