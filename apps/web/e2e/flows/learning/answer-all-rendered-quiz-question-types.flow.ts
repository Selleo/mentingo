import { expect, type Locator, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";

export type AnswerAllRenderedQuizQuestionTypesFlowInput = {
  singleChoiceOptionIds: string[];
  multipleChoiceOptionIds: string[];
  trueOrFalseAnswers: { optionId: string; value: "true" | "false" }[];
  photoSingleChoiceOptionIds: string[];
  photoMultipleChoiceOptionIds: string[];
  textBlankAnswer: string;
  dndBlankAnswer: string;
  dndBlankAnswerId: string;
  briefResponse: string;
  detailedResponse: string;
  matchingPairs: { optionId: string; match: string }[];
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
  answers: AnswerAllRenderedQuizQuestionTypesFlowInput,
) => {
  const optionIds = [
    ...answers.singleChoiceOptionIds,
    ...answers.multipleChoiceOptionIds,
    ...answers.photoSingleChoiceOptionIds,
    ...answers.photoMultipleChoiceOptionIds,
  ];

  for (const optionId of optionIds) {
    await page.getByTestId(LEARNING_HANDLES.quizOption(optionId)).click();
  }

  for (const { optionId, value } of answers.trueOrFalseAnswers) {
    await page.getByTestId(LEARNING_HANDLES.trueOrFalseOption(optionId, value)).click();
  }

  await page.getByTestId(LEARNING_HANDLES.textBlank(1)).fill(answers.textBlankAnswer);

  // Draggable words are found by the word itself (test data), not by copy.
  const quizForm = page.getByTestId(LEARNING_HANDLES.QUIZ_FORM);
  const dndBlank = quizForm.getByTestId(LEARNING_HANDLES.dndBlank(answers.dndBlankAnswerId));
  await chooseInBlank(page, dndBlank, answers.dndBlankAnswer);
  await expect(dndBlank).toContainText(answers.dndBlankAnswer);

  // The first pair is dragged and the rest are chosen from the list, so both input paths stay covered.
  for (const [pairIndex, { optionId, match }] of answers.matchingPairs.entries()) {
    const pairSlot = quizForm.getByTestId(LEARNING_HANDLES.matchingSlot(optionId));

    if (pairIndex === 0) {
      await dragWithMouse(page, quizForm.getByRole("button", { name: match }), pairSlot);
    } else {
      await chooseInBlank(page, pairSlot, match);
    }

    await expect(pairSlot).toContainText(match);
  }

  await page.getByTestId(LEARNING_HANDLES.BRIEF_RESPONSE_INPUT).fill(answers.briefResponse);
  await page.getByTestId(LEARNING_HANDLES.DETAILED_RESPONSE_INPUT).fill(answers.detailedResponse);
};
