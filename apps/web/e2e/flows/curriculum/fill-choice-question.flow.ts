import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import { ensureQuizQuestionBodyFlow } from "./ensure-quiz-question-body.flow";

import type { Page } from "@playwright/test";

type FillChoiceQuestionInput = {
  questionIndex?: number;
  title: string;
  options: string[];
  correctIndexes: number[];
};

export const fillChoiceQuestionFlow = async (
  page: Page,
  { questionIndex = 0, title, options, correctIndexes }: FillChoiceQuestionInput,
) => {
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex)).fill(title);
  await ensureQuizQuestionBodyFlow(
    page,
    questionIndex,
    QUIZ_LESSON_FORM_HANDLES.optionInput(questionIndex, 0),
  );

  for (const [optionIndex, option] of options.entries()) {
    const optionInput = page.getByTestId(
      QUIZ_LESSON_FORM_HANDLES.optionInput(questionIndex, optionIndex),
    );

    if ((await optionInput.count()) === 0) {
      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.addOptionButton(questionIndex)).click();
    }

    await optionInput.fill(option);

    if (correctIndexes.includes(optionIndex)) {
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.correctOptionControl(questionIndex, optionIndex))
        .click();
    }
  }
};
