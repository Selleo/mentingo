import { expect, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";

type AnswerAllRenderedQuizQuestionTypesFlowInput = {
  dndBlankAnswer: string;
  dndBlankAnswerId: string;
  textBlankAnswer: string;
};

export const answerAllRenderedQuizQuestionTypesFlow = async (
  page: Page,
  {
    dndBlankAnswer,
    dndBlankAnswerId,
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
  const dndWord = quizForm.getByRole("button", { name: dndBlankAnswer });
  const dndBlank = quizForm.getByTestId(`blank:${dndBlankAnswerId}`);
  await dndWord.scrollIntoViewIfNeeded();
  await dndBlank.scrollIntoViewIfNeeded();

  const wordBox = await dndWord.boundingBox();
  const blankBox = await dndBlank.boundingBox();

  if (!wordBox || !blankBox) throw new Error("DND quiz answer or blank was not visible");

  await page.mouse.move(wordBox.x + wordBox.width / 2, wordBox.y + wordBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(blankBox.x + blankBox.width / 2, blankBox.y + blankBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(dndBlank).toContainText(dndBlankAnswer);

  await page.getByTestId("brief-response").fill("Brief answer");
  await page.getByTestId("detailed-response").fill("Detailed answer");
};
