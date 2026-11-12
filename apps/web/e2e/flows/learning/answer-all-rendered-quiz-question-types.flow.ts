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
  await dragWithMouse(page, quizForm.getByRole("button", { name: dndBlankAnswer }), dndBlank);
  await expect(dndBlank).toContainText(dndBlankAnswer);

  for (const { prompt, match } of matchingPairs) {
    const pairSlot = quizForm
      .locator('[data-testid^="matching-pair-"]')
      .filter({ hasText: prompt })
      .locator("[data-testid]");

    await dragWithMouse(page, quizForm.getByRole("button", { name: match }), pairSlot);
    await expect(pairSlot).toContainText(match);
  }

  await page.getByTestId("brief-response").fill("Brief answer");
  await page.getByTestId("detailed-response").fill("Detailed answer");
};
