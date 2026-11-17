import { match } from "ts-pattern";

import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import { addQuizQuestionFlow } from "./add-quiz-question.flow";
import { fillChoiceQuestionFlow } from "./fill-choice-question.flow";
import { fillFillBlanksQuestionFlow } from "./fill-fill-blanks-question.flow";
import { fillPhotoQuestionFlow } from "./fill-photo-question.flow";

import type { Page } from "@playwright/test";
import type { AssessmentScoringMode } from "@repo/shared";

export type QuizQuestionInput =
  | {
      kind: "choice";
      type: QuestionType.SINGLE_CHOICE | QuestionType.MULTIPLE_CHOICE | QuestionType.TRUE_OR_FALSE;
      title: string;
      options: string[];
      correctIndexes: number[];
    }
  | {
      kind: "photo";
      type: QuestionType.PHOTO_QUESTION_SINGLE_CHOICE | QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE;
      title: string;
      imagePath: string;
      options: string[];
      correctIndexes: number[];
    }
  | {
      kind: "fillBlanks";
      type: QuestionType.FILL_IN_THE_BLANKS_TEXT | QuestionType.FILL_IN_THE_BLANKS_DND;
      title: string;
      sentence: string;
      words: string[];
    }
  | {
      kind: "matching";
      title: string;
      pairs: [prompt: string, match: string][];
      scoringMode: AssessmentScoringMode;
    }
  | {
      kind: "titleOnly";
      type: QuestionType.SCALE_1_5 | QuestionType.BRIEF_RESPONSE | QuestionType.DETAILED_RESPONSE;
      title: string;
    };

/** Adds a question of the given kind at `questionIndex` in the open quiz lesson form and fills it. */
export const fillQuizQuestionFlow = async (
  page: Page,
  questionIndex: number,
  question: QuizQuestionInput,
) => {
  await match(question)
    .with({ kind: "choice" }, async ({ type, title, options, correctIndexes }) => {
      await addQuizQuestionFlow(page, type, questionIndex);
      await fillChoiceQuestionFlow(page, { questionIndex, title, options, correctIndexes });
    })
    .with({ kind: "photo" }, async ({ type, title, imagePath, options, correctIndexes }) => {
      // The selector has a single photo entry; the single/multiple subtype is picked inside the question.
      await addQuizQuestionFlow(page, QuestionType.PHOTO_QUESTION_SINGLE_CHOICE, questionIndex);
      await fillPhotoQuestionFlow(page, {
        questionIndex,
        title,
        imagePath,
        type,
        options,
        correctIndexes,
      });
    })
    .with({ kind: "fillBlanks" }, async ({ type, title, sentence, words }) => {
      await addQuizQuestionFlow(page, type, questionIndex);
      await fillFillBlanksQuestionFlow(page, { questionIndex, title, sentence, words });
    })
    .with({ kind: "matching" }, async ({ title, pairs, scoringMode }) => {
      await addQuizQuestionFlow(page, QuestionType.MATCHING, questionIndex);
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex))
        .fill(title);

      for (const [pairIndex, [prompt, matchText]] of pairs.entries()) {
        await page
          .getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingPromptInput(questionIndex, pairIndex))
          .fill(prompt);
        await page
          .getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(questionIndex, pairIndex))
          .fill(matchText);
      }

      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingScoringSelect(questionIndex)).click();
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingScoringOption(questionIndex, scoringMode))
        .click();
    })
    .with({ kind: "titleOnly" }, async ({ type, title }) => {
      await addQuizQuestionFlow(page, type, questionIndex);
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex))
        .fill(title);
    })
    .exhaustive();
};
