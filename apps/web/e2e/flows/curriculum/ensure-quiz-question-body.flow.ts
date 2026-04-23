import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const ensureQuizQuestionBodyFlow = async (
  page: Page,
  questionIndex: number,
  visibleBodyHandle: string,
) => {
  const bodyLocator = page.getByTestId(visibleBodyHandle);

  if ((await bodyLocator.count()) > 0 && (await bodyLocator.first().isVisible())) {
    return;
  }

  const questionCard = page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionCard(questionIndex));
  const questionToggle = page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionToggle(questionIndex));

  await questionCard.scrollIntoViewIfNeeded();
  await questionToggle.click();
  await bodyLocator.waitFor({ state: "visible" });
};
