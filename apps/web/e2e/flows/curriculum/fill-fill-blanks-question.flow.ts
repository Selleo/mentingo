import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import { ensureQuizQuestionBodyFlow } from "./ensure-quiz-question-body.flow";

import type { Page } from "@playwright/test";

type FillBlanksQuestionInput = {
  questionIndex?: number;
  title: string;
  words: string[];
  sentence: string;
};

export const fillFillBlanksQuestionFlow = async (
  page: Page,
  { questionIndex = 0, title, words, sentence }: FillBlanksQuestionInput,
) => {
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex)).fill(title);
  await ensureQuizQuestionBodyFlow(
    page,
    questionIndex,
    QUIZ_LESSON_FORM_HANDLES.fillBlanksEditor(questionIndex),
  );
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.fillBlanksEditor(questionIndex)).click();
  await page.keyboard.type(sentence);

  for (const word of words) {
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.addWordButton(questionIndex)).click();
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.newWordInput(questionIndex)).fill(word);
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.saveWordButton(questionIndex)).click();

    const editor = page.getByTestId(QUIZ_LESSON_FORM_HANDLES.fillBlanksEditor(questionIndex));

    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.dragWordButton(questionIndex, word)).waitFor();
    await editor.evaluate((element, wordToDrop) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text", wordToDrop);

      element.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
      element.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    }, word);
    await editor.locator(`button[data-word="${word}"]`).waitFor();
  }
};
