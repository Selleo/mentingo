import { expect, type Locator, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";

type AnswerAllRenderedQuizQuestionTypesFlowInput = {
  dndBlankAnswer: string;
  dndBlankAnswerId: string;
  matchingPairs: { prompt: string; match: string }[];
  textBlankAnswer: string;
};

const dragWithMouse = async (page: Page, source: Locator, target: Locator) => {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) throw new Error("Drag source or drop target was not visible");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
};

const chooseInBlank = async (page: Page, blank: Locator, answer: string) => {
  await blank.getByTestId(LEARNING_HANDLES.BLANK_SELECT_TRIGGER).click();
  await page.getByTestId(LEARNING_HANDLES.blankSelectOption(answer)).click();
};

export const answerAllRenderedQuizQuestionTypesFlow = async (
  page: Page,
  {
    dndBlankAnswer,
    dndBlankAnswerId,
    matchingPairs,
    textBlankAnswer,
  }: AnswerAllRenderedQuizQuestionTypesFlowInput,
) => {
  await page.locator('input[name^="singleAnswerQuestions."]').first().click();
  await page.locator('input[name^="multiAnswerQuestions."]').nth(0).click();
  await page.locator('input[name^="multiAnswerQuestions."]').nth(1).click();
  await page.locator('input[name^="trueOrFalseQuestions."][value="true"]').first().click();
  await page.locator('input[name^="trueOrFalseQuestions."][value="false"]').nth(1).click();
  await page.locator('input[name^="photoQuestionSingleChoice."]').first().click();
  await page.locator('input[name^="photoQuestionMultipleChoice."]').nth(0).click();
  await page.locator('input[name^="photoQuestionMultipleChoice."]').nth(1).click();
  await page.getByTestId("text-blank-1").fill(textBlankAnswer);

  const quizForm = page.getByTestId(LEARNING_HANDLES.QUIZ_FORM);
  const dndBlank = quizForm.getByTestId(`blank:${dndBlankAnswerId}`);
  await chooseInBlank(page, dndBlank, dndBlankAnswer);
  await expect(dndBlank).toContainText(dndBlankAnswer);

  // The first pair is dragged and the rest are chosen from the list, so both input paths stay covered.
  for (const [pairIndex, { prompt, match }] of matchingPairs.entries()) {
    const pairSlot = quizForm
      .locator('[data-testid^="matching-pair-"]')
      .filter({ hasText: prompt })
      .locator("[data-testid]")
      .first();

    if (pairIndex === 0) {
      await dragWithMouse(page, quizForm.getByRole("button", { name: match }), pairSlot);
    } else {
      await chooseInBlank(page, pairSlot, match);
    }

    await expect(pairSlot).toContainText(match);
  }

  await page.getByTestId("brief-response").fill("Brief answer");
  await page.getByTestId("detailed-response").fill("Detailed answer");
};
