import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import { ensureQuizQuestionBodyFlow } from "./ensure-quiz-question-body.flow";

import type { Page } from "@playwright/test";
import type { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

type FillPhotoQuestionInput = {
  questionIndex?: number;
  title: string;
  imagePath: string;
  type: QuestionType;
  options: string[];
  correctIndexes: number[];
};

export const fillPhotoQuestionFlow = async (
  page: Page,
  { questionIndex = 0, title, imagePath, type, options, correctIndexes }: FillPhotoQuestionInput,
) => {
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex)).fill(title);
  await ensureQuizQuestionBodyFlow(
    page,
    questionIndex,
    QUIZ_LESSON_FORM_HANDLES.photoTypeSelect(questionIndex),
  );
  await page
    .getByTestId(QUIZ_LESSON_FORM_HANDLES.photoUploadInput(questionIndex))
    .setInputFiles(imagePath);
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.photoTypeSelect(questionIndex)).click();
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.photoTypeOption(questionIndex, type)).click();

  for (const [optionIndex, option] of options.entries()) {
    if (optionIndex > 1) {
      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.addOptionButton(questionIndex)).click();
    }

    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.optionInput(questionIndex, optionIndex))
      .fill(option);

    if (correctIndexes.includes(optionIndex)) {
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.correctOptionControl(questionIndex, optionIndex))
        .click();
    }
  }
};
